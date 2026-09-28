// The fixture writer: Writer <in.dxf> <out.dwg> <version>, the version an ACadVersion name (AC1032).
// ACadSharp's DXF reader leaves each ATTRIB beside its INSERT instead of inside it, so every ATTRIB
// that follows an INSERT in its block record is moved back into that INSERT before writing.
using ACadSharp;
using ACadSharp.Entities;
using ACadSharp.IO;

if (args.Length != 3)
{
    Console.Error.WriteLine("usage: Writer <in.dxf> <out.dwg> <version>");
    return 2;
}
var doc = DxfReader.Read(args[0]);
foreach (var record in doc.BlockRecords)
{
    Insert? last = null;
    foreach (var entity in record.Entities.ToList())
    {
        switch (entity)
        {
            case Insert insert:
                last = insert;
                break;
            case AttributeEntity attribute when last is not null:
                record.Entities.Remove(attribute);
                last.Attributes.Add(attribute);
                break;
            default:
                last = null;
                break;
        }
    }
}
doc.Header.Version = Enum.Parse<ACadVersion>(args[2]);
using (var writer = new DwgWriter(args[1], doc))
{
    writer.Write();
}
return 0;
