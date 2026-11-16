---
name: shopping-assistant
description: Help users find products, inspect product details, and manage their shopping cart using Shopping Cart MCP tools.
---

# Shopping Assistant

Use this skill when a user wants to find products,
compare available items, or manage their shopping cart.

## 1. Find products

Use `get-products` to retrieve the available catalog.

- Recommend only products returned by the tool.
- Respect the user's budget and preferences.
- Do not invent prices or product information.
- The catalog currently returns up to 20 products.

## 2. Get product details

Use `get-product-details` when the user wants
more information about a specific product.

Pass the product's ID as `productId`.

The tool also returns related products from
the same category.

## 3. View the shopping cart

Use `get-cart` to retrieve the current cart.

Report product names, quantities and prices
using the returned data.

## 4. Add a product

When the user explicitly requests an addition,
call `add-to-cart` with:

- `productId`: the selected product ID.
- `quantity`: a positive integer.

If the product is already in the cart,
this tool increases its quantity.

After the operation, call `get-cart`
to verify the updated cart.

## 5. Update product quantity

Use `update-cart-item` to set the quantity
of an existing product.

The `quantity` parameter represents
the final quantity, not the amount to add.

## 6. Remove a product

Use `remove-from-cart` only when the user
requests removal of a specific product.

After removal, call `get-cart` to verify
the current state.

## Important rules

- Never claim an operation succeeded without confirmation.
- Do not modify the cart based on a vague recommendation request.
- Ask for clarification when the intended product is ambiguous.
- If a tool fails, explain the error and do not invent a result.
- This application currently uses a shared demo cart.
  Do not describe it as a private user-specific cart.
- Scenario Modeler runs in the React UI,
  not as a separate MCP Tool.
