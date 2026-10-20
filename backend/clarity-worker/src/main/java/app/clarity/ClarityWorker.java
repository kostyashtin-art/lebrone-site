
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
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Locale;

public final class ClarityWorker {

    private static final Gson GSON = new GsonBuilder()
            .disableHtmlEscaping()
            .create();

    private static final int MAX_EVENTS = 100_000;

    private final JsonWriter writer;
    private long totalEvents = 0;
    private long eventsReturned = 0;

    private ClarityWorker(JsonWriter writer) {
        this.writer = writer;
    }

    @OnCombatLogEntry
    public void onCombatLogEntry(CombatLogEntry entry) {
        totalEvents++;

        if (eventsReturned >= MAX_EVENTS) {
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

      GSON.toJson(event, writer);
eventsReturned++;
    }

    private static void put(
            JsonObject object,
            String key,
            String value
    ) {
        if (value != null && !value.isBlank()) {
            object.addProperty(key, value);
        }
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

        System.err.println("Replay path: " + replay);
        System.err.println("Replay size: " + Files.size(replay));
        System.err.println(
                "Replay header HEX: "
                        + java.util.HexFormat.of().formatHex(
                                Files.readAllBytes(replay),
                                0,
                                (int) Math.min(16, Files.size(replay))
                        )
        );

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
            System.err.println("Output: " + resultPath);
        }
    }
}

