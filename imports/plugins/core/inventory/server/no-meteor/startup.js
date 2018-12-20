
import appEvents from "/imports/node-app/core/util/appEvents";
import updateCatalogProductInventoryStatus from "/imports/plugins/core/catalog/server/no-meteor/utils/updateCatalogProductInventoryStatus";

/**
 * @summary Called on startup
 * @param {Object} context Startup context
 * @param {Object} context.collections Map of MongoDB collections
 * @returns {undefined}
 */
export default function startup(context) {
  appEvents.on("afterOrderCancel", async (order, returnToStock) => {
    const { collections } = context;

    // Inventory is removed from stock only once an order has been approved
    // This is indicated by payment.status being anything other than `created`
    // We need to check to make sure the inventory has been removed before we return it to stock
    const orderIsApproved = order.shipping.find((group) => group.payment.status !== "created");

    // Create a new set of unique productIds
    // We do this because variants might have the same productId
    // and we don't want to update the product each time a variant is it's child
    // we can map over the unique productIds at the end, and update each one once
    const uniqueProductsToUpdate = new Set();

    // If order is approved, the inventory has been taken away from both `inventoryQuantity` and `inventoryAvailableToSell`
    if (returnToStock && orderIsApproved) {
    // Run this Product update inline instead of using ordersInventoryAdjust because the collection hooks fail
    // in some instances which causes the order not to cancel
      const orderItems = order.shipping.reduce((list, group) => [...list, ...group.items], []);
      orderItems.forEach(async (item) => {
        const updatedItem = await collections.Products.findOneAndUpdate(
          {
            _id: item.variantId
          },
          {
            $inc: {
              inventoryAvailableToSell: +item.quantity,
              inventoryQuantity: +item.quantity
            }
          }
        );

        // Update parents of supplied item
        await collections.Products.updateMany(
          {
            _id: { $in: updatedItem.ancestors }
          },
          {
            $inc: {
              inventoryAvailableToSell: +item.quantity,
              inventoryQuantity: +item.quantity
            }
          }
        );

        uniqueProductsToUpdate.add(item.productId);
      });

      // Publish inventory updates to the Catalog
      const uniqueProducts = Array.from(uniqueProductsToUpdate);
      uniqueProducts.forEach(async (uniqueProduct) => {
        await updateCatalogProductInventoryStatus(uniqueProduct.productId, collections);
      });
    }

    // If order is not approved, the inventory hasn't been taken away from `inventoryQuantity`, but has been taken away from `inventoryAvailableToSell`
    if (!orderIsApproved) {
    // Run this Product update inline instead of using ordersInventoryAdjust because the collection hooks fail
    // in some instances which causes the order not to cancel
      const orderItems = order.shipping.reduce((list, group) => [...list, ...group.items], []);
      orderItems.forEach(async (item) => {
        const updatedItem = await collections.Products.findOneAndUpdate(
          {
            _id: item.variantId
          },
          {
            $inc: {
              inventoryAvailableToSell: +item.quantity
            }
          }
        );

        // Update parents of supplied item
        await collections.Products.updateMany(
          {
            _id: { $in: updatedItem.ancestors }
          },
          {
            $inc: {
              inventoryAvailableToSell: +item.quantity
            }
          }
        );

        uniqueProductsToUpdate.add(item.productId);
      });

      // Publish inventory updates to the Catalog
      const uniqueProducts = Array.from(uniqueProductsToUpdate);
      uniqueProducts.forEach(async (uniqueProduct) => {
        await updateCatalogProductInventoryStatus(uniqueProduct.productId, collections);
      });
    }
  });

  appEvents.on("afterOrderCreate", async (order) => {
    const { collections } = context;
    const orderItems = order.shipping.reduce((list, group) => [...list, ...group.items], []);

    // Create a new set of unique productIds
    // We do this because variants might have the same productId
    // and we don't want to update the product each time a variant is it's child
    // we can map over the unique productIds at the end, and update each one once
    const uniqueProductsToUpdate = new Set();

    orderItems.forEach(async (item) => {
      // Update supplied item inventory
      const updatedItem = await collections.Products.findOneAndUpdate(
        {
          _id: item.variantId
        },
        {
          $inc: {
            inventoryAvailableToSell: -item.quantity
          }
        }
      );

      // Update supplied item inventory
      await collections.Products.updateMany(
        {
          _id: { $in: updatedItem.ancestors }
        },
        {
          $inc: {
            inventoryAvailableToSell: -item.quantity
          }
        }
      );

      uniqueProductsToUpdate.add(item.productId);
    });

    // Publish inventory updates to the Catalog
    const uniqueProducts = Array.from(uniqueProductsToUpdate);
    uniqueProducts.forEach(async (uniqueProduct) => {
      await updateCatalogProductInventoryStatus(uniqueProduct.productId, collections);
    });
  });
}
