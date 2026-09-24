// Sets every entry of the generated paper palette, so the pinned renderer reads each one (palette-typ.test.ts).
#import "/base/palette.typ": basis-colour, basis-glyph, element-colour
#for (basis, hex) in basis-colour [#text(fill: rgb(hex))[#basis-glyph.at(basis) #basis] ]
#for (name, hex) in element-colour [#box(width: 4mm, height: 4mm, fill: rgb(hex)) #name ]
