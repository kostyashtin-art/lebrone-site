package app.clarity;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.JsonObject;
import com.google.gson.stream.JsonWriter;
import skadistats.clarity.model.CombatLogEntry;
import skadistats.clarity.processor.gameevents.OnCombatLogEntry;
import skadistats.clarity.processor.runner.SimpleRunner;
import skadistats.clarity.source.MappedFileSource;

import java.io.BufferedWriter;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.util.Locale;

/** Parses a Dota replay and streams combat-log events to JSON to reduce heap usage. */
public final class ClarityWorker {
    private static final Gson GSON = new GsonBuilder()
            .disableHtmlEscaping()
            .create();

    // The limit protects the service from unexpectedly huge replays.
    // Events are written as they arrive; they are not accumulated in memory.
    private static final long MAX_EVENTS = 100_000;

    private final JsonWriter json;
    private long totalEvents = 0;
    private long eventsReturned = 0;
    private IOException outputError;

    private ClarityWorker(JsonWriter json) throws IOException {
        this.json = json;
        json.setIndent("  ");
        json.beginObject();
        json.name("events").beginArray();
    }

    @OnCombatLogEntry
    public void onCombatLogEntry(CombatLogEntry entry) {
        totalEvents++;
        if (eventsReturned >= MAX_EVENTS || outputError != null) {
            return;
        }

        JsonObject event = new JsonObject();
        event.addProperty("time", Math.max(0, entry.getTimestamp()));
        event.addProperty(
                "type",
                entry.getType() == null
                        ? "UNKNOWN"
                        : entry.getType().name().toLowerCase(Locale.ROOT)
        );
        put(event, "attacker", entry.getAttackerName());
        put(event, "target", entry.getTargetName());
        put(event, "ability", entry.getInflictorName());
        event.addProperty("value", entry.getValue());
        event.addProperty("x", entry.getLocationX());
        event.addProperty("y", entry.getLocationY());
        event.addProperty("attacker_team", entry.getAttackerTeam());

        try {
            GSON.toJson(event, json);
            eventsReturned++;
        } catch (IOException exc) {
            outputError = exc;
            throw new IllegalStateException("Could not stream replay event JSON", exc);
        }
    }

    private static void put(JsonObject obj, String key, String value) {
        if (value != null && !value.isBlank()) {
            obj.addProperty(key, value);
        }
    }

    private static void diagnoseReplay(Path replay) throws IOException {
        System.err.println("========== REPLAY DIAGNOSTICS ==========");
        System.err.println("Replay path: " + replay);
        System.err.println("Replay size: " + Files.size(replay) + " bytes");
        byte[] header = new byte[16];
        try (InputStream input = Files.newInputStream(replay)) {
            int count = input.read(header);
            if (count > 0) {
                System.err.println("Replay header HEX: "
                        + java.util.HexFormat.of().formatHex(header, 0, count));
                System.err.println("Replay header ASCII: "
                        + new String(header, 0, count, StandardCharsets.US_ASCII)
                        .replaceAll("[^\\x20-\\x7E]", "."));
            } else {
                System.err.println("Replay header: EMPTY FILE");
            }
        }
        System.err.println("========================================");
    }

    public static void main(String[] args) throws Exception {
        if (args.length < 2) {
            System.err.println("Usage: java -jar clarity-worker.jar <replay.dem> <output-directory>");
            System.exit(2);
            return;
        }

        Path replay = Path.of(args[0]).toAbsolutePath().normalize();
        Path outputDir = Path.of(args[1]).toAbsolutePath().normalize();
        if (!Files.isRegularFile(replay)) {
            throw new IllegalArgumentException("Replay file does not exist: " + replay);
        }
        Files.createDirectories(outputDir);
        diagnoseReplay(replay);

        Path resultPath = outputDir.resolve("parsed-events.json");
        long start = System.nanoTime();
        ClarityWorker worker;

        try (BufferedWriter fileWriter = Files.newBufferedWriter(
                    resultPath,
                    StandardCharsets.UTF_8,
                    StandardOpenOption.CREATE,
                    StandardOpenOption.TRUNCATE_EXISTING,
                    StandardOpenOption.WRITE);
             JsonWriter jsonWriter = new JsonWriter(fileWriter);
             MappedFileSource source = new MappedFileSource(replay.toString())) {

            worker = new ClarityWorker(jsonWriter);
            new SimpleRunner(source).runWith(worker);

            if (worker.outputError != null) {
                throw worker.outputError;
            }

            jsonWriter.endArray();
            jsonWriter.name("parser").value("Clarity");
            jsonWriter.name("parser_version").value("4.0.1");
            jsonWriter.name("event_type").value("combat_log");
            jsonWriter.name("events_total").value(worker.totalEvents);
            jsonWriter.name("events_returned").value(worker.eventsReturned);
            jsonWriter.name("truncated").value(worker.totalEvents > worker.eventsReturned);
            jsonWriter.name("parse_time_ms").value((System.nanoTime() - start) / 1_000_000L);
            jsonWriter.endObject();
            jsonWriter.flush();
        }

        System.err.println("Clarity parsing completed.");
        System.err.println("Events total: " + worker.totalEvents);
        System.err.println("Events returned: " + worker.eventsReturned);
        System.err.println("Truncated: " + (worker.totalEvents > worker.eventsReturned));
        System.err.println("Output: " + resultPath);
    }
}
