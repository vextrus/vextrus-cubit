// The ACadSharp dumper (ticket 10; ADR 0029): the second, independent decoder's view of one DWG.
//
//     acadsharp-dump <in.dwg> <out.jsonl>
//
// It writes, one JSON value per line (UTF-8, `\n` endings):
//     {"dumper": "acadsharp-dump", "format": 2, "acadsharp": "3.8.0", "dwg_version": "AC1032"}
//     {"unread": "8C", "type": "INSERT", "error": "ArgumentOutOfRangeException"}
//                                    one line per entity ACadSharp could not read (below)
//     ["8D", "LINE", "0"]            one line per entity read: its handle (upper-case hex), type, layer
//     {"end": 1234, "unread": 1}     the counts of both kinds of line, so a cut-off dump is never whole
//
// The entities are those of every block record (model space, each paper-space layout and each block
// definition), in record order, and each insert's attributes after the insert. A polyline's vertices
// and its SEQEND are not written: ACadSharp holds them inside the polyline, as 04's reader does
// (engine/read/libredwg/dwgread.py). Entities ACadSharp does not support are kept, under their class
// name, so their handles still count. The comparison is Python's (engine/check/decoders_agree.py);
// this program counts nothing and decides nothing.
//
// **Entities it could not read** (the owner's ruling of 28 Sep 2026, "Hold it"). It reads with
// `Failsafe` on, so one entity ACadSharp cannot read does not end the read: ACadSharp leaves it out
// and raises an Error notification, "Could not read <TYPE> with handle: <decimal>" (or "<DXF name>
// number <class> with handle: …" for a class-based type; its DwgObjectReader.Read, 3.8.0). Each such
// notification whose type is an entity's is written as an `unread` line, with the exception's type
// and never its message (which may quote the drawing). The case that asked for it, an INSERT whose
// stored scale is 0, is now read as 1 (ACadSharp built with DomCR/ACadSharp#1205's repair, W317;
// engine/fixtures/dwg/zero_z_scale.py). **Every other Error notification** (an object that is not an
// entity, a message of any other shape, one without its exception) **and any exception that escapes
// is a failure**: exit 1, the error's type on stderr, never a dump with things silently missing.
// Warnings, and notices of what ACadSharp does not implement or support, are not errors and are
// ignored (unresolved references, classes it does not know).
//
// It runs in the reader's sandbox (engine/read/sandbox.py): no network, the file read-only, and only
// its output folder writable. Of the files it names, it opens only its two arguments; the .NET
// runtime's own diagnostics pipes are described in acadsharp-dump.csproj. A failure never aborts the
// process, which could leave a core file.
using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.RegularExpressions;
using ACadSharp;
using ACadSharp.Entities;
using ACadSharp.IO;

if (args.Length != 2)
{
    Console.Error.WriteLine("usage: acadsharp-dump <in.dwg> <out.jsonl>");
    return 2;
}

var notified = new List<Notified>();
var otherErrors = 0;
var configuration = new DwgReaderConfiguration
{
    Failsafe = true,
    KeepUnknownEntities = true,
    KeepUnknownNonGraphicalObjects = false,
    ReadSummaryInfo = false,
};
try
{
    CadDocument document;
    using (var input = File.OpenRead(args[0]))
    {
        document = DwgReader.Read(input, configuration, (sender, e) =>
        {
            if (e.NotificationType != NotificationType.Error)
            {
                return;
            }
            var found = Notified.Parse(e);
            if (found is null)
            {
                otherErrors++;
            }
            else
            {
                notified.Add(found);
            }
        });
    }
    var unread = notified.Where(n => n.IsEntity(document)).ToList();
    if (otherErrors > 0 || unread.Count != notified.Count)
    {
        Console.Error.WriteLine("acadsharp-dump: ErrorNotification");
        return 1;
    }
    Dump(document, unread, args[1]);
    return 0;
}
catch (Exception error)
{
    Console.Error.WriteLine($"acadsharp-dump: {error.GetType().Name}");
    return 1;
}

static void Dump(CadDocument document, List<Notified> unread, string path)
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
        json.WriteNumber("format", 2);
        json.WriteString("acadsharp", $"{acadsharp.Major}.{acadsharp.Minor}.{acadsharp.Build}");
        json.WriteString("dwg_version", document.Header.Version.ToString());
        json.WriteEndObject();
    });
    foreach (var item in unread)
    {
        Line(json =>
        {
            json.WriteStartObject();
            json.WriteString("unread", item.Handle.ToString("X"));
            json.WriteString("type", item.Type);
            json.WriteString("error", item.Error);
            json.WriteEndObject();
        });
    }
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
        json.WriteNumber("unread", unread.Count);
        json.WriteEndObject();
    });
    buffered.Flush();
}

// One "Could not read …" Error notification: the object's handle, its type as ACadSharp names it (an
// ObjectType, or a class's DXF name with its class number), and the exception's type.
sealed record Notified(ulong Handle, string Type, short? ClassNumber, string Error)
{
    // The ObjectTypes that are entities (ACadSharp 3.8.0's enum; DICTIONARY, 42, is not one).
    static readonly HashSet<int> EntityTypes =
    [
        .. Enumerable.Range(1, 8), .. Enumerable.Range(10, 32), .. Enumerable.Range(43, 5), 74, 77, 78, 498,
    ];

    // A plain Regex, not a [GeneratedRegex]: the generator's file-local types are named after a hash of
    // the source's path, which would put the build folder into the program's bytes.
    static readonly Regex CouldNotRead = new(
        @"^Could not read (?<type>\S{1,256}?)(?: number (?<class>-?\d{1,5}))? with handle: (?<handle>\d{1,20})$",
        RegexOptions.CultureInvariant);

    public static Notified? Parse(NotificationEventArgs e)
    {
        var match = CouldNotRead.Match(e.Message ?? "");
        if (!match.Success || e.Exception is null || !ulong.TryParse(match.Groups["handle"].Value, out var handle))
        {
            return null;
        }
        short? classNumber = null;
        if (match.Groups["class"].Success)
        {
            if (!short.TryParse(match.Groups["class"].Value, out var number))
            {
                return null;
            }
            classNumber = number;
        }
        return new Notified(handle, match.Groups["type"].Value, classNumber, e.Exception.GetType().Name);
    }

    public bool IsEntity(CadDocument document)
    {
        if (ClassNumber is short number)
        {
            return document.Classes.FirstOrDefault(c => c.ClassNumber == number) is { IsAnEntity: true } found
                && found.DxfName == Type;
        }
        return Enum.TryParse<ObjectType>(Type, out var type)
            && Enum.IsDefined(type)
            && type.ToString() == Type
            && EntityTypes.Contains((int)type);
    }
}
