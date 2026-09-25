# Vextrus

Vextrus is an AI-native platform for the AEC business, starting in Bangladesh: one project dataset,
built first from a client's 2D drawings, that every department and professional on a project works
from.

## Language

### People and organisations

**Developer**:
A real-estate development firm that builds and sells residential or commercial buildings; Vextrus's
first paying customer.
_Avoid_: client (ambiguous), builder, owner (the Developer's MD is the buyer; "owner" alone is
ambiguous with the building's end owner)

**QS**:
The quantity surveyor or estimation engineer, at the Developer or working for it, who measures
quantities from drawings and prices them; the first daily user.
_Avoid_: estimator (use QS), surveyor

### What the Developer gets

**Priced BOQ**:
The bill of quantities for a building, item by item by trade, with a rate and an amount in ৳ on every
item; each quantity traces back to where it was read on the drawings.
_Avoid_: estimate (use it only for the total cost figure), register, bill

**Material Schedule**:
The quantities of basic materials (cement, sand, stone chips, rod by diameter, bricks and the like)
the building needs, broken down by floor and by construction stage, derived from the same takeoff
as the Priced BOQ.
_Avoid_: material list, BOM

**Building Model**:
The 3D model of the building assembled from the QS-confirmed takeoff; the project dataset that the
Priced BOQ, the Material Schedule and every later module are read from.
_Avoid_: BIM (as a noun for our object), 3D view, digital twin
