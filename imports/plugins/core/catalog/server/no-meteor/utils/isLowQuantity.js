import getVariantQuantity from "/imports/plugins/core/revisions/server/no-meteor/utils/getVariantQuantity";

/**
 * @method isLowQuantity
 * @summary If at least one of the product variants quantity is less than the low inventory threshold return `true`.
 * @memberof Catalog
 * @param {Array} variants - Array of child variants
 * @param {Object} collections - Raw mongo collections are passed to ProductRevision
 * @return {boolean} low quantity or not
 */
export default async function isLowQuantity(variants, collections) {
  const promises = variants.map(async (variant) => {
    const quantity = await getVariantQuantity(variant, collections, variants);
    if (variant.inventoryManagement && variant.inventoryPolicy && quantity) {
      return quantity <= variant.lowInventoryWarningThreshold;
    }
    return false;
  });
  const results = await Promise.all(promises);
  return results.every((result) => result);
}
