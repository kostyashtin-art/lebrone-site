
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
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Locale;

/**
 * Parses a Dota 2 replay with Clarity.
 *
 * Events are written directly to a JSON file to reduce memory usage.
 */
public final class ClarityWorker {

    private static final Gson GSON = new GsonBuilder()
            .disableHtmlEscaping()
            .create();

    private static final int MAX_EVENTS = 100_000;

    private final JsonWriter jsonWriter;

    private long totalEvents = 0;
    private long eventsReturned = 0;

    private ClarityWorker(JsonWriter jsonWriter) {
        this.jsonWriter = jsonWriter;
    }

    /**
     * Receives combat-log events and writes them immediately.
     */
    @OnCombatLogEntry
    public void onCombatLogEntry(CombatLogEntry entry) {
        totalEvents++;

        if (eventsReturned >= MAX_EVENTS) {
            return;
        }

        JsonObject event = new JsonObject();

        event.addProperty(
                "time",
                Math.max(0, entry.getTimestamp())
        );

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

       
try (MappedFileSource source = new MappedFileSource(replay.toString())) {
    new SimpleRunner(source).runWith(worker);
}
 catch (IOException e) {
            throw new UncheckedIOException(
                    "Failed to write replay event to JSON",
                    e
            );
        }
    }

    private static void put(
            JsonObject obj,
            String key,
            String value
    ) {
        if (value != null && !value.isBlank()) {
            obj.addProperty(key, value);
        }
    }

    /**
     * Prints diagnostic information about the replay file.
     */
    private static void diagnoseReplay(Path replay) throws IOException {
        System.err.println("========== REPLAY DIAGNOSTICS ==========");
        System.err.println("Replay path: " + replay);
        System.err.println("Replay size: " + Files.size(replay) + " bytes");

        byte[] header = new byte[16];

        try (InputStream input = Files.newInputStream(replay)) {
            int count = input.read(header);

            if (count > 0) {
                System.err.println(
                        "Replay header HEX: "
                                + java.util.HexFormat.of()
                                .formatHex(header, 0, count)
                );

                System.err.println(
                        "Replay header ASCII: "
                                + new String(
                                        header,
                                        0,
                                        count,
                                        StandardCharsets.US_ASCII
                                ).replaceAll("[^\\x20-\\x7E]", ".")
                );
            } else {
                System.err.println("Replay header: EMPTY FILE");
            }
        }

        System.err.println("========================================");
    }

    public static void main(String[] args) throws Exception {
        if (args.length < 2) {
            System.err.println(
                    "Usage: java -jar clarity-worker.jar "
                            + "<replay.dem> <output-directory>"
            );
            System.exit(2);
            return;
        }

        Path replay = Path.of(args[0])
                .toAbsolutePath()
                .normalize();

        Path outputDir = Path.of(args[1])
                .toAbsolutePath()
                .normalize();

        if (!Files.isRegularFile(replay)) {
            throw new IllegalArgumentException(
                    "Replay file does not exist: " + replay
            );
        }

        Files.createDirectories(outputDir);
        diagnoseReplay(replay);

        Path resultPath = outputDir.resolve("parsed-events.json");

        long start = System.nanoTime();

        try (
                BufferedWriter fileWriter = Files.newBufferedWriter(
                        resultPath,
                        StandardCharsets.UTF_8
                );
                JsonWriter jsonWriter = new JsonWriter(fileWriter)
        ) {
            jsonWriter.setSerializeNulls(false);

            jsonWriter.beginObject();

            jsonWriter.name("parser").value("Clarity");
            jsonWriter.name("parser_version").value("4.0.1");
            jsonWriter.name("event_type").value("combat_log");

            // Stream each event directly into the JSON output file.
            jsonWriter.name("events").beginArray();

            ClarityWorker worker = new ClarityWorker(jsonWriter);

            try (MappedFileSource source =
                         new MappedFileSource(replay.toString())) {
                new SimpleRunner(source).runWith(worker);
            }

            jsonWriter.endArray();

            long elapsedMs =
                    (System.nanoTime() - start) / 1_000_000L;

            jsonWriter.name("events_total").value(worker.totalEvents);
            jsonWriter.name("events_returned").value(worker.eventsReturned);
            jsonWriter.name("truncated").value(
                    worker.totalEvents > worker.eventsReturned
            );
            jsonWriter.name("parse_time_ms").value(elapsedMs);

            jsonWriter.endObject();
            jsonWriter.flush();

            System.err.println(
                    "Clarity parsing completed. Total events: "
                            + worker.totalEvents
            );

            System.err.println(
                    "Events returned: " + worker.eventsReturned
            );

            System.err.println(
                    "Truncated: "
                            + (worker.totalEvents > worker.eventsReturned)
            );

            System.err.println("Parse time: " + elapsedMs + " ms");
            System.err.println("Output: " + resultPath);
        }
    }
}

