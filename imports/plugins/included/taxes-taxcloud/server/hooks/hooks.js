import { Meteor } from "meteor/meteor";
import { HTTP } from "meteor/http";
import { Logger, MethodHooks, Reaction } from "/server/api";
import { Shops, Cart } from "/lib/collections";

/**
 * @name zipSplit
 * @summary returns ZIP4 and ZIP4 value from a zip code.
 * @method
 * @param  {String} pincode the pincode to be parsed
 * @return {Object} returns { zip4: <ZIP4>, zip5: <ZIP5> }
 */
function zipSplit(pincode) {
  const zipReg = /(?:([\d]{4})-?)?([\d]{5})$/;
  if (!pincode) return { zip4: null, zip5: null };
  const result = pincode.match(zipReg);
  if (!result) return { zip4: null, zip5: null };
  return { zip4: result[1], zip5: result[2] };
}

/**
 * @name calculateTax
 * @summary gets tax from the API and updates the cart.
 * @method
 * @param  {Object} pkgSettings tax-cloud settings
 * @param  {Object} cartToCalc cart object from the database.
 */
function calculateTax(pkgSettings, cartToCalc) {
  Logger.debug("TaxCloud triggered on taxes/calculate for cartId:", cartToCalc._id);
  const url = "https://api.taxcloud.net/1.0/TaxCloud/Lookup";
  const shopItemsMap = {};

  // format cart items to TaxCloud structure
  let index = 0;
  const { items } = cartToCalc;
  // Create mapping of shops -> items
  for (const cartItem of items) {
    // only processs taxable products
    if (cartItem.variants.taxable === true) {
      const taxCloudItem = {
        Index: index,
        ItemID: cartItem.variants._id,
        TIC: cartItem.variants.taxCode || "00000",
        Price: cartItem.variants.price,
        Qty: cartItem.quantity
      };
      index += 1;
      if (!shopItemsMap[cartItem.shopId]) {
        shopItemsMap[cartItem.shopId] = [];
      }
      shopItemsMap[cartItem.shopId].push(taxCloudItem);
    }
  }
  const shippingAddressMap = cartToCalc.shipping.reduce((addressMap, shipping) => {
    if (!addressMap[shipping.shopId]) {
      addressMap[shipping.shopId] = shipping.address;
    }
    return addressMap;
  }, {});
  // Create a map of shopId -> shopAddress
  const shopsList = Shops.find({ _id: { $in: Object.keys(shopItemsMap) } }, { _id: 1, addressBook: 1 }).fetch();
  let shopsHaveAddress = true;
  const shopsAddressMap = shopsList.reduce((addressMap, shop) => {
    if (!shop.addressBook) {
      shopsHaveAddress = false;
      return;
    }
    [addressMap[shop._id]] = shop.addressBook;
    return addressMap;
  }, {});
  if (!shopsHaveAddress) {
    // All the marketplace shops don't have address yet.
    Logger.error("All the marketplace shops don't have address yet.");
    return;
  }
  let totalTax = 0;
  const subtotalsByShop = cartToCalc.getSubtotalByShop();
  const subTotal = cartToCalc.getSubTotal();
  const responsePromise = [];
  // For each shop get the tax on the products.
  Object.keys(shopItemsMap).forEach((shopId) => {
    const taxCloudSettings = Reaction.getPackageSettingsWithOptions({ name: "taxes-taxcloud", shopId });
    const { apiKey, apiLoginId } = taxCloudSettings.settings.taxcloud;
    if (!apiKey || !apiLoginId) {
      Logger.warn("TaxCloud API Key is required.");
    }
    const shopAddress = shopsAddressMap[shopId];
    const { zip4: Zip4, zip5: Zip5 } = zipSplit(shopAddress.postal);
    const origin = {
      Address1: shopAddress.address1,
      City: shopAddress.city,
      State: shopAddress.region,
      Zip5,
      Zip4
    };

    const shippingAddress = shippingAddressMap[shopId];
    // User hasn't entered shipping address yet.
    if (!shippingAddress) return;
    const destination = {
      Address1: shippingAddress.address1,
      City: shippingAddress.city,
      State: shippingAddress.region,
      Zip5: shippingAddress.postal
    };

    // request object
    const request = {
      headers: {
        "accept": "application/json",
        "content-type": "application/json"
      },
      data: {
        apiKey,
        apiLoginId,
        customerID: cartToCalc.userId,
        cartItems: shopItemsMap[shopId],
        origin,
        destination,
        cartID: cartToCalc._id,
        deliveredBySeller: false
      }
    };
    // pushing all the requests to array.
    responsePromise.push(new Promise((resolve, reject) => {
      HTTP.post(url, request, (error, response) => {
        // ResponseType 3 is a successful call.
        if (response.data.ResponseType !== 3) {
          let errMsg = "Unable to access service. Check credentials.";
          if (response && response.data.Messages[0].Message) {
            errMsg = response.data.Messages[0].Message;
          }
          reject();
          throw new Error("Error calling taxcloud API", errMsg);
        }
        resolve({
          items: response.data.CartItemsResponse,
          shopId
        });
      });
    }));
  });

  try {
    Promise.all(responsePromise).then((result) => {
      result.forEach((res) => {
        for (const item of res.items) {
          totalTax += item.TaxAmount;
          const cartPosition = item.CartItemIndex;
          items[cartPosition].taxRate =
          item.TaxAmount / subtotalsByShop[res.shopId];
        }
      });
      // we should consider if we want percentage and dollar
      // as this is assuming that subTotal actually contains everything
      // taxable
      Meteor.call("taxes/setRateByShopAndItem", cartToCalc._id, {
        taxRatesByShop: undefined,
        itemsWithTax: items,
        cartTaxRate: totalTax / subTotal,
        cartTaxData: undefined
      });
    });
  } catch (error) {
    Logger.error("Error fetching tax rate from TaxCloud:", error);
  }
}
//
// this entire method will run after the core/taxes
// plugin runs the taxes/calculate method
// it overrwites any previous tax calculation
// tax methods precendence is determined by
// load order of plugins
//
MethodHooks.after("taxes/calculate", (options) => {
  const result = options.result || {};
  const cartId = options.arguments[0];
  const cartToCalc = Cart.findOne(cartId);
  if (cartToCalc) {
    const pkgSettings = Reaction.getPackageSettings("taxes-taxcloud");
    if (pkgSettings && pkgSettings.settings.taxcloud.enabled === true) {
      if (Array.isArray(cartToCalc.shipping) && cartToCalc.shipping.length > 0 && cartToCalc.items) {
        calculateTax(pkgSettings, cartToCalc);
      }
    }
  }
  // Default return value is the return value of previous call in method chain
  // or an empty object if there's no result yet.
  return result;
});
