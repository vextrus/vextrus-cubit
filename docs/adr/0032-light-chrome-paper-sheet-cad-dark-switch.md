# The app is light, the sheet opens as plotted, and a CAD-dark canvas is one switch away

The app's chrome is light, like Revit's default and like Excel, where the QS already works. The 2D
sheet opens as the consultant plotted it: white paper, black linework with true lineweights. One
switch gives a CAD-dark canvas (black ground, AutoCAD's layer colours) for the QS who thinks in model
space; AutoCAD's colours do not survive on white, so it is a switch, not a blend. The 3D Building
Model renders on a light ground in a "shaded with edges" style, coloured by status. A full dark theme
may follow if users ask; the tokens keep it a second palette, not a rewrite.

Why: every document the product hands over (the Priced BOQ, Excel, PDF) is light, offices in Dhaka
are bright, and the MD reads and prints figures; dark-first reads as a developer tool. The old
product's dark default was a ruling never tested on a user (docs/research/design-legacy.md §5).

The design system that applies it is docs/design/system.md.

## History
- 26 Sep 2026: decided. Evidence: docs/research/design-legacy.md §5. The owner's ruling (26 Sep 2026):
  "Agree".
