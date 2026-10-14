-- Owner update (Oct 2026): no longer serving these dishes.
-- Hidden instead of deleted so order history stays intact and they can be
-- brought back from Admin → Menu → Edit → "Show on website".
UPDATE "MenuItem"
SET "active" = false, "preorderable" = false, "featured" = false
WHERE "slug" IN (
  'chocoflan',
  'tostadas-de-tinga',
  'horchata',
  'strawberry-creamy',
  'taco-machaca',
  'taco-chorizo',
  'taco-picadillo',
  'taco-bistec'
);
