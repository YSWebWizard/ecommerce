/* eslint camelcase: 0 */
import accounting from "accounting-js";
import Shopify from "shopify-api-node";
import { Reaction, Logger } from "/server/api";
import { Orders, Shops } from "/lib/collections";
import { getApiInfo } from "../methods/api";


function markExported(exportedOrder, shopId, order) {
  Orders.update({ _id: order._id }, {
    $push: {
      exportHistory: {
        status: "success",
        dateAttempted: new Date(),
        exportMethod: "reaction-connectors-shopify",
        destinationIdentifier: exportedOrder.id,
        shopId: shopId
      }
    }
  });
}

function markExportFailed(doc) {
  const order = Orders.findOne(doc._id); // only this object has the original transforms defined
  const shops = Object.keys(order.getItemsByShop());
  shops.forEach((shopId) => {
    Orders.update({ _id: order._id }, {
      $push: {
        exportHistory: {
          status: "failed",
          dateAttempted: new Date(),
          exportMethod: "reaction-connectors-shopify",
          shopId: shopId
        }
      }
    });
  });
}


function convertRcOrderToShopifyOrder(doc, index, shopId) {
  const order = Orders.findOne(doc._id); // only this object has the original transforms defined
  const shopifyOrder = {};
  const billingAddress = convertAddress(order.billing[index].address);
  shopifyOrder.billing_address = billingAddress;
  const shippingAddress = convertAddress(order.shipping[index].address);
  shopifyOrder.shipping_address = shippingAddress;
  shopifyOrder.customer = convertCustomer(billingAddress, order);
  shopifyOrder.email = order.email;
  const paymentType = order.billing[index].method;
  if (paymentType === "credit" && order.billing[index].mode === "authorize") {
    shopifyOrder.financial_status = "authorized";
  } else {
    shopifyOrder.financial_status = "paid";
  }
  shopifyOrder.id = order._id;
  const itemsForShop = order.getItemsByShop()[shopId];
  shopifyOrder.line_items = convertLineItems(itemsForShop, order);
  // Not sure if we can/should do transactions
  // shopifyOrder.transactions = convertTransactions(order.billing[index].paymentMethod);
  shopifyOrder.phone = order.billing[index].address.phone;
  shopifyOrder.source_name = "reaction_export";
  shopifyOrder.subtotal_price = order.getSubtotalByShop()[shopId];
  shopifyOrder.token = order._id;
  shopifyOrder.total_discounts = accounting.toFixed(order.getDiscountsByShop()[shopId], 2);
  shopifyOrder.total_line_item_price = order.getItemsByShop()[shopId].reduce((total, item) => {
    return total + item.variants.price;
  }, 0);
  shopifyOrder.total_price = accounting.toFixed(order.getTotalByShop()[shopId]);
  shopifyOrder.total_tax = order.getTaxesByShop()[shopId];
  shopifyOrder.total_weight = shopifyOrder.line_items.reduce((sum, item) => {
    return sum + (item.grams * item.quantity);
  }, 0);
  return shopifyOrder;
}

function normalizeWeight(weight, shopId) {
  // if weight is not grams, convert to grams if is grams just return
  const shop = Shops.findOne(shopId);
  const { baseUOM } = shop;
  // Could've used switch, this was easier to read
  // should these be a utilities module somewhere?
  if (baseUOM === "g") {
    return weight;
  }
  if (baseUOM === "lb") {
    const grams = weight * 453.592;
    return grams;
  }

  if (baseUOM === "oz") {
    const grams = weight * 28.35;
    return grams;
  }

  if (baseUOM === "kg") {
    const grams = weight / 1000;
    return grams;
  }
}

function convertLineItems(items, order) {
  const lineItems = items.map((item) => {
    const lineItem = {};
    lineItem.fulfillable_quantity = item.quantity;
    lineItem.fulfillment_service = "manual";
    lineItem.fullfillment_status = null;
    if (item.parcel && item.parcel.weight) {
      lineItem.grams = normalizeWeight(item.parcel.weight, item.shopId);
    }
    lineItem.id = item._id;
    lineItem.product_id = item.productId;
    lineItem.quantity = item.quantity;
    lineItem.requires_shipping = item.product.requiresShipping;
    // lineItem.sku = ??? Not sure what should be the SKU here
    lineItem.title = item.product.title;
    lineItem.variant_id = item.variants._id;
    lineItem.variant_title = item.variants.title;
    lineItem.vendor = item.product.vendor;
    lineItem.taxable = item.variants.taxable;
    lineItem.price = item.variants.price;
    if (order.taxes) {
      lineItem.tax_lines = [];
      // when using Avalara we get tax detail
      // get the tax iten for this particular line
      const taxItem = order.taxes.filter((tax) => tax.lineNumber === item._id);
      taxItem.details.forEach((detail) => {
        const taxLine = {
          title: detail.taxName,
          price: accounting.toFixed(detail.taxCalculated, 2),
          rate: detail.rate
        };
        lineItem.tax_lines.push(taxLine);
      });
    }
    // for custom tax codes we get this one data point
    if (item.taxData) {
      lineItem.tax_lines = [{
        title: item.taxData.taxCode,
        price: accounting.toFixed((item.taxData.rate / 100) * item.variants.price, 2),
        rate: item.taxData.rate / 100
      }];
    }
    // lineItem.total_discount = ????;
    return lineItem;
  });
  return lineItems;
}

// function convertTransactions(paymentMethod) {
//   return paymentMethod;
// }

function convertAddress(address) {
  const convertedAddress = {};
  convertedAddress.address1 = address.address1;
  convertedAddress.address2 = address.address2 || "";
  convertedAddress.city = address.city;
  convertedAddress.country = address.country;
  convertedAddress.country_code = address.country;
  convertedAddress.name = address.fullName;
  const [ firstName, ...lastName ] = address.fullName.split(" ");
  convertedAddress.first_name = firstName;
  convertedAddress.last_name = lastName.join(" ");
  convertedAddress.phone = address.phone;
  convertedAddress.zip = address.postal;
  convertedAddress.province_code = address.region;
  return convertedAddress;
}

function convertCustomer(address, order) {
  let phone;
  if (address.country_code === "US") {
    phone = `+1${address.phone}`; // shopify wants this corny +1 in front of the phone
  } else {
    phone = address.phone;
  }
  const customer = {
    accepts_marketing: false,
    email: order.email,
    phone,
    first_name: address.first_name,
    last_name: address.last_name
  };
  return customer;
}

export async function exportToShopify(doc) {
  const numShopOrders = doc.billing.length; // if we have multiple billing, we have multiple shops
  Logger.debug(`Exporting ${numShopOrders} order(s) to Shopify`);
  const shopifyOrders = [];
  for (let index = 0; index < numShopOrders; index++) {
    // send a shopify order once for each merchant order
    const shopId = doc.billing[index].shopId;
    const shopifyOrder = convertRcOrderToShopifyOrder(doc, index, shopId);
    Logger.debug("sending shopify order", shopifyOrder, doc._id);
    const apiCreds = getApiInfo(shopId);
    const shopify = new Shopify(apiCreds);
    const newShopifyOrder = await shopify.order.create(shopifyOrder);
    markExported(newShopifyOrder, shopId, doc);
    shopifyOrders.push(newShopifyOrder);
  }
  return shopifyOrders;
}


Orders.after.insert((userId, doc) => {
  const pkgData = Reaction.getPackageSettings("reaction-connectors-shopify");
  if (pkgData) {
    const { settings } = pkgData;
    const { synchooks } = settings;
    if (synchooks) {
      synchooks.forEach((hook) => {
        if (hook.topic === "orders" && hook.event === "orders/create") {
          if (hook.syncType === "exportToShopify") { // should this just be dynamic?
            try {
              exportToShopify(doc)
                .then(exportedOrders => {
                  Logger.debug("exported order(s)", exportedOrders);
                })
                .catch(error => {
                  Logger.error("Encountered error when exporting to shopify", error);
                  Logger.error(error.response.body);
                  markExportFailed(doc);
                });
            } catch (error) {
              Logger.error("Error exporting to Shopify", error);
              return true;
            }
          }
        }
      });
    }
  }
});
