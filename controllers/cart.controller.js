import Cart from "../models/cart.model.js";
import CartItem from "../models/cartItem.model.js";
import Product from "../models/product.model.js";
import ProductVariant from "../models/productVariation.model.js";
import ProductImage from "../models/productImage.model.js";

//Add to cart
export const addToCart = async (req, res) => {
  try {
    const { productId, variationId, quantity } = req.body;
    const user_id = req.user.id;
    if (!productId || !variationId || !quantity) {
      return res.status(400).json({
        success: false,
        message: "Please provide all required fields",
      });
    }
    if (isNaN(quantity) || quantity <= 0) {
      return res.status(400).json({
        success: false,
        message: "Quantity must be a positive number",
      });
    }
    //Check cart exists
    let cart = await Cart.findOne({ user_id });
    //If not create one
    if (!cart) {
      cart = await Cart.create({ user_id });
    }
    //Check if product exists
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }
    //Check if variation exists
    const variation = await ProductVariant.findById(variationId);
    if (!variation) {
      return res.status(404).json({
        success: false,
        message: "Variation not found",
      });
    }
    //Check if cart item exists
    let cartItem = await CartItem.findOne({
      cart_id: cart._id,
      product_id: productId,
      variation_id: variationId,
    });
    //add quantity if exists
    if (cartItem) {
      cartItem.quantity += quantity;
      await cartItem.save();
    } else {
      //Create new cart item
      cartItem = await CartItem.create({
        cart_id: cart._id,
        product_id: productId,
        variation_id: variationId,
        quantity,
      });
    }
    //Update cart total
    cart.total_price += variation.price * quantity;
    await cart.save();
    //Populate cart items
    const cartItems = await CartItem.find({ cart_id: cart._id })
      .populate("product_id")
      .populate("variation_id");
    //Return response
    res.status(200).json({
      success: true,
      data: {
        cart: {
          ...cart._doc,
          items: cartItems,
        },
      },
    });
  } catch (error) {
    console.error("Error in adding to cart: ", error.message);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

//Get cart
export const getCart = async (req, res) => {
  try {
    const user_id = req.user.id;
    //Check cart exists
    const cart = await Cart.findOne({ user_id });
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: "Cart not found",
      });
    }
    //Populate cart items
    const cartItems = await CartItem.find({ cart_id: cart._id })
      .populate("product_id")
      .populate("variation_id");
    // Lấy danh sách productId và variationId
    const productIds = cartItems.map((item) => item.product_id._id);
    const variationIds = cartItems.map((item) => item.variation_id._id);
    // Lấy thông tin sản phẩm, biến thể và ảnh
    const [products, variations, productImages] = await Promise.all([
      Product.find({ _id: { $in: productIds } }),
      ProductVariant.find({ _id: { $in: variationIds } }),
      ProductImage.find({ productId: { $in: productIds } }),
    ]);
    // Map cart items để trả về chi tiết sản phẩm, biến thể và số lượng đã add
    const cartItemsWithDetails = cartItems.map((item) => {
      const product = products.find(
      (product) => product._id.toString() === item.product_id._id.toString()
      );
      const variation = variations.find(
      (variation) => variation._id.toString() === item.variation_id._id.toString()
      );
      const images = productImages.filter(
      (image) => image.productId.toString() === product._id.toString()
      );
      return {
      product: {
        ...product._doc,
        images: images.map((image) => image.imageUrl),
      },
      variation: {
        ...variation._doc,
      },
      quantity: item.quantity, // Số lượng người dùng đã add vào cho variation này
      cartItemId: item._id,
      };
    });
    // Trả về response
    res.status(200).json({
      success: true,
      data: {
      cart: {
        ...cart._doc,
        total_price: cart.total_price,
        total_items: cartItemsWithDetails.length,
        items: cartItemsWithDetails,
      },
      },
    });
  } catch (error) {
    console.error("Error in getting cart: ", error.message);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

//Update cart item
export const updateCartItem = async (req, res) => {
  try {
    const cartItemId = req.params.cartItemId;
    const { quantity } = req.body;
    if (!cartItemId || !quantity) {
      return res.status(400).json({
        success: false,
        message: "Please provide all required fields",
      });
    }
    if (isNaN(quantity) || quantity <= 0) {
      return res.status(400).json({
        success: false,
        message: "Quantity must be a positive number",
      });
    }
    //Check cart item exists
    const cartItem = await CartItem.findById(cartItemId);
    if (!cartItem) {
      return res.status(404).json({
        success: false,
        message: "Cart item not found",
      });
    }
    //Check cart exists
    const cart = await Cart.findById(cartItem.cart_id);
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: "Cart not found",
      });
    }
    //Check variation exists
    const variation = await ProductVariant.findById(cartItem.variation_id);
    if (!variation) {
      return res.status(404).json({
        success: false,
        message: "Variation not found",
      });
    }
    //Update cart item quantity
    const oldQuantity = cartItem.quantity;
    cartItem.quantity = quantity;
    await cartItem.save();
    //Update cart total
    cart.total_price += (quantity - oldQuantity) * variation.price;
    await cart.save();
    //Return response
    res.status(200).json({
      success: true,
      data: {
        cart: {
          ...cart._doc,
          items: [cartItem],
        },
      },
    });
  } catch (error) {
    console.error("Error in updating cart item: ", error.message);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};
//Delete cart item
export const deleteCartItem = async (req, res) => {
  try {
    const cartItemId = req.params.cartItemId;
    if (!cartItemId) {
      return res.status(400).json({
        success: false,
        message: "Please provide all required fields",
      });
    }
    //Check cart item exists
    const cartItem = await CartItem.findById(cartItemId);
    if (!cartItem) {
      return res.status(404).json({
        success: false,
        message: "Cart item not found",
      });
    }
    //Check cart exists
    const cart = await Cart.findById(cartItem.cart_id);
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: "Cart not found",
      });
    }
    //Check variation exists
    const variation = await ProductVariant.findById(cartItem.variation_id);
    if (!variation) {
      return res.status(404).json({
        success: false,
        message: "Variation not found",
      });
    }
    //Delete cart item
    await CartItem.findByIdAndDelete(cartItemId);
    //Update cart total
    cart.total_price -= variation.price * cartItem.quantity;
    await cart.save();
    //Return response
    res.status(200).json({
      success: true,
      data: {
        cart: {
          ...cart._doc,
          items: [],
        },
      },
    });
  } catch (error) {
    console.error("Error in deleting cart item: ", error.message);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};
