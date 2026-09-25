# Quantities are stored in SI and shown in the project's Display Units

Every quantity, dimension and rate is held in SI inside Vextrus (the Building Model, the maths, the
Rate Analyses). What the QS sees is formatted at the edge in the project's Display Units, which
default to private Dhaka practice:
- cft for RCC and earthwork;
- sft for plaster, flooring and brickwork;
- rft for skirting and railings;
- kg or ton for rod;
- bags for cement.

Metric is one switch away. The Benchmark Rate (PWD, metric) is converted to the same unit so it sits
beside the working rate. Money is always ৳, grouped in lakh and crore. Grouping applies to money
only, never to lengths or coordinates.

We chose this because private practice measures in imperial while PWD and the codes are metric, so a
BOQ in m³ looks foreign to a Dhaka QS. SI inside keeps the engineering, the IFC model and later
markets correct. One unit system inside plus a formatting layer outside prevents a class of error
Vextrus Cubit shipped: lakh grouping on millimetre coordinates. Drawings arrive in their own units
(the Edison set is in inches) and are converted to SI on reading.
