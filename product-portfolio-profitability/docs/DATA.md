# Data

## Availability

The five source files are __not distributed with this repository__ and are not
reproduced anywhere in it. They were supplied as coursework assessment material
and no redistribution licence for them could be confirmed.

To run the analysis, place these files in `data/raw/`:

```
data/raw/customers_set_14.csv
data/raw/order_items_set_14.csv
data/raw/orders_set_14.csv
data/raw/products_set_14.csv
data/raw/sellers_set_14.csv
```

`data/raw/` is excluded by `.gitignore`, so the files cannot be committed by
accident.

## Provenance

The origin of the dataset is __not documented__ in the source notebook, and it
could not be verified. What is known is recorded below and nothing further is
claimed.

- The files are named with a `_set_14` suffix, which is consistent with one
  numbered variant among several distributed to different assessment groups.
- The table structure is a conventional transactional star schema for an online
  marketplace, with customers, sellers, orders, order lines, and products.
- No licence file, data dictionary, collection date, or citation accompanied the
  files.

A verified source could not be confirmed, so no citation for the dataset is
given. Any statement about who collected the data, when, or under what terms
would be an invention.

## Recorded Shapes

These are the table shapes observed in the recorded execution. The loader
compares the files it finds against them and prints a warning if they differ, so
results computed from a different input can never be mistaken for the published
ones.

| Table | Rows | Columns |
|---|---|---|
| customers | 11,904 | 9 |
| order_items | 26,072 | 7 |
| orders | 11,904 | 8 |
| products | 1,990 | 10 |
| sellers | 500 | 8 |

## Schema

Only the columns the analysis reads are documented here. Columns present in the
files but never referenced are counted, not named, because their names were not
recorded anywhere that could be verified.

### orders (8 columns, all referenced)

| Column | Type | Use |
|---|---|---|
| `order_id` | Text | Primary key. Joined to `order_items.order_no`. |
| `order_status` | Text | Filter. Values observed: `delivered`, `canceled`. |
| `customer_no` | Text | Carried into the fact table. Not used in the model. |
| `order_purchase_timestamp` | Date, day first | Reporting period. |
| `order_approved_at` | Date, day first | Parsed. Not used downstream. |
| `order_delivered_carrier_date` | Date, day first | Parsed. Not used downstream. |
| `order_delivered_customer_date` | Date, day first | Parsed. Not used downstream. |
| `order_estimated_delivery_date` | Date, day first | Parsed. Not used downstream. |

### order_items (7 columns, 5 referenced)

| Column | Type | Use |
|---|---|---|
| `order_no` | Text | Foreign key to `orders.order_id`. Null on 100 rows. |
| `product_no` | Text | Foreign key to `products.product_id`. |
| `price` | Numeric | Gross unit price before discount. |
| `freight_value` | Numeric | Fulfillment charge attributed to the line. |
| `discount_rate` | Numeric, 0 to 1 | Proportional discount applied to the line. |

Two further columns exist and are not referenced by the analysis.

### products (10 columns, 7 referenced)

| Column | Type | Use |
|---|---|---|
| `product_id` | Text | Primary key. |
| `product_category_name` | Text | Seven categories. Model feature and reporting dimension. |
| `cost` | Numeric | Unit cost of goods. Null on 99 rows. |
| `product_weight_g` | Numeric | Model feature. |
| `product_length_cm` | Numeric | Component of `volume_cm3`. |
| `product_height_cm` | Numeric | Component of `volume_cm3`. |
| `product_width_cm` | Numeric | Component of `volume_cm3`. |

Three further columns exist and are not referenced by the analysis.

Categories observed: `auto`, `books`, `electronics`, `fashion`, `furniture`,
`home_goods`, `toys`.

### customers (9 columns) and sellers (500 rows, 8 columns)

Loaded for the data quality profile in Section 3 of the notebook. No column from
either table enters the fact table or the model.

## Derived Fields

| Field | Formula |
|---|---|
| `cost_clean` | `cost`, with nulls filled by the median cost of the same category |
| `net_revenue` | `price x (1 - discount_rate)` |
| `cogs` | `cost_clean` |
| `gross_profit` | `net_revenue - cogs` |
| `contribution_profit` | `gross_profit - freight_value` |
| `volume_cm3` | `product_length_cm x product_height_cm x product_width_cm` |
| `unit_gross_margin` | `unit_price - unit_cost` |

## Recorded Assumptions

These are assumptions rather than verified facts. Each one is stated here so a
reader can judge how much weight the results carry.

1. __Currency is undocumented.__ Nothing in the source files identifies a
   currency. All amounts are presented as US dollars, following the convention
   of the original analysis. This is a presentation choice, not a finding.
2. __One row of `order_items` is one unit.__ No quantity column is referenced.
   Revenue is computed as one price per row.
3. __Timestamps are day first.__ Confirmed by the fact that day first parsing
   left zero unparsed values across 11,904 rows in the recorded run.
4. __A product carries a single price.__ The product level aggregation takes the
   first observed price and cost. The notebook counts and reports any product
   that violates this rather than letting it pass silently.
5. __`freight_value` is a cost, not a customer charge.__ It is subtracted from
   gross profit, which treats it as a cost borne by the platform.
6. __Cancelled orders generate no recognised revenue.__ They are excluded from
   every total and from the model.

## Outputs

Both are written by the pipeline and both are excluded from version control,
because they are derived from data the repository does not contain.

| File | Content |
|---|---|
| `data/processed/training_data.csv` | One row per product, with the features, the target, and the train or holdout flag |
| `data/processed/metrics.json` | Every reported metric, coefficient, and total in machine readable form |
