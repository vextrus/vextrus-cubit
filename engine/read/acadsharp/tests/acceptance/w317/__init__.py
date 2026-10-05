"""Ticket W317's acceptance (#317; the owner's ruling of 5 Oct 2026, "Build ACadSharp with #1205
ourselves"): the dumper is built from ACadSharp 3.8.0's source plus DomCR/ACadSharp#1205's DWG scale
repair, fetched by `tools/acadsharp-dump/prepare-source.sh` at pins `toolchain/acadsharp-source.lock`
holds, so an INSERT whose stored scale is 0 is read as AutoCAD's AUDIT repairs it and the file agrees.
Each pinned dumper is installed beside the others, in a folder named by its pin.
"""
