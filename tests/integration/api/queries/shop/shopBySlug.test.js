import { encodeShopOpaqueId } from "@reactioncommerce/reaction-graphql-xforms/shop";
import TestApp from "/imports/test-utils/helpers/TestApp";

jest.setTimeout(300000);

let shopBySlagQuery;
let shopId;
const shopName = "Slug Integration Test";
let testApp;
let opaqueShopId;
const shopSlug = "integ-test-shop-slug";

beforeAll(async () => {
  testApp = new TestApp();
  await testApp.start();
  shopId = await testApp.insertPrimaryShop({ slug: shopSlug, name: shopName });
  opaqueShopId = encodeShopOpaqueId(shopId);
  shopBySlagQuery = testApp.query(`query ($slug: String!) {
    shopBySlug(slug: $slug) {
      _id
      name
    }
  }`);
});

afterAll(async () => {
  await testApp.collections.Shops.deleteMany({});
  await testApp.stop();
});

test("get shop by slug success", async () => {
  const result = await shopBySlagQuery({ slug: shopSlug });
  expect(result.shopBySlug.name).toBe(shopName);
  expect(result.shopBySlug._id).toBe(opaqueShopId);
});

test("get shop by slug failure", async () => {
  const result = await shopBySlagQuery({ slug: "does-not-exist" });
  expect(result.shopBySlug).toBeNull();
});
