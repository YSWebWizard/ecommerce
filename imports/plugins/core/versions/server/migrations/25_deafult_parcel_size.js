import { Migrations } from "meteor/percolate:migrations";
import { Shops } from "/lib/collections";
import { convertWeight, convertLength } from "/lib/api";

Migrations.add({
  version: 25,
  up() {
    const shops = Shops.find().fetch();
    shops.forEach((shop) => {
      const defaultParcelSize = {
        weight: convertWeight("lb", shop.baseUOM, 8),
        height: convertLength("in", shop.baseUOL, 6),
        length: convertLength("in", shop.baseUOL, 11.25),
        width: convertLength("in", shop.baseUOL, 8.75)
      };
      Shops.update({ _id: shop._id }, { $set: { defaultParcelSize } });
    });
  },
  down() {
    const shops = Shops.find().fetch();
    shops.forEach((shop) => {
      Shops.update({ _id: shop._id }, { $unset: { defaultParcelSize: 1 } });
    });
  }
});
