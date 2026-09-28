// The ACadSharp dumper (ticket 10; ADR 0029): the second, independent decoder's view of one DWG.
//
//     acadsharp-dump <in.dwg> <out.jsonl>
//
// It writes, one JSON value per line (UTF-8, `\n` endings):
//     {"dumper": "acadsharp-dump", "format": 1, "acadsharp": "3.8.0", "dwg_version": "AC1032"}
//     ["8D", "LINE", "0"]            one line per entity: its handle (upper-case hex), type, layer
//     {"end": 1234}                  the number of entity lines, so a cut-off dump is never whole
//
// The entities are those of every block record (model space, each paper-space layout and each block
// definition), in record order, and each insert's attributes after the insert. A polyline's vertices
// and its SEQEND are not written: ACadSharp holds them inside the polyline, as 04's reader does
// (engine/read/libredwg/dwgread.py). Entities ACadSharp does not support are kept, under their class
// name, so their handles still count. The comparison is Python's (engine/check/decoders_agree.py);
// this program counts nothing and decides nothing.
//
// It reads the file with `Failsafe` off: an error ACadSharp meets, reading or writing, is a failure
// (exit 1, the error's type on stderr, never its message, which may quote the drawing), never a
// document with objects silently missing, and never an abort that could leave a core file. It runs in the reader's sandbox (engine/read/sandbox.py): no network, the file
// read-only, and only its output folder writable. Of the files it names, it opens only its two
// arguments; the .NET runtime's own diagnostics pipes are described in acadsharp-dump.csproj.
using System.Text.Encodings.Web;
using System.Text.Json;
using ACadSharp;
using ACadSharp.Entities;
using ACadSharp.IO;

if (args.Length != 2)
{
    Console.Error.WriteLine("usage: acadsharp-dump <in.dwg> <out.jsonl>");
    return 2;
}

var configuration = new DwgReaderConfiguration
{
    Failsafe = false,
    KeepUnknownEntities = true,
    KeepUnknownNonGraphicalObjects = false,
    ReadSummaryInfo = false,
};
try
{
    CadDocument document;
    using (var input = File.OpenRead(args[0]))
    {
        document = DwgReader.Read(input, configuration);
    }
    Dump(document, args[1]);
    return 0;
}
catch (Exception error)
{
    Console.Error.WriteLine($"acadsharp-dump: {error.GetType().Name}");
    return 1;
}

static void Dump(CadDocument document, string path)
{
    var options = new JsonWriterOptions { Encoder = JavaScriptEncoder.Default, Indented = false };
    var newline = new byte[] { (byte)'\n' };
    long count = 0;
    using var output = new FileStream(path, FileMode.CreateNew, FileAccess.Write);
    using var buffered = new BufferedStream(output, 1 << 16);

    void Line(Action<Utf8JsonWriter> write)
    {
        using (var json = new Utf8JsonWriter(buffered, options))
        {
            write(json);
        }
        buffered.Write(newline);
    }

    void Entity(Entity entity)
    {
        Line(json =>
        {
            json.WriteStartArray();
            json.WriteStringValue(entity.Handle.ToString("X"));
            json.WriteStringValue(entity.ObjectName);
            json.WriteStringValue(entity.Layer?.Name ?? "");
            json.WriteEndArray();
        });
        count++;
    }

    var acadsharp = typeof(CadDocument).Assembly.GetName().Version!;
    Line(json =>
    {
        json.WriteStartObject();
        json.WriteString("dumper", "acadsharp-dump");
        json.WriteNumber("format", 1);
        json.WriteString("acadsharp", $"{acadsharp.Major}.{acadsharp.Minor}.{acadsharp.Build}");
        json.WriteString("dwg_version", document.Header.Version.ToString());
        json.WriteEndObject();
    });
    foreach (var record in document.BlockRecords)
    {
        foreach (var entity in record.Entities)
        {
            Entity(entity);
            if (entity is Insert insert)
            {
                foreach (var attribute in insert.Attributes)
                {
                    Entity(attribute);
                }
            }
        }
    }
    Line(json =>
    {
        json.WriteStartObject();
        json.WriteNumber("end", count);
        json.WriteEndObject();
    });
    buffered.Flush();
}
