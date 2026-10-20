package app.clarity;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import skadistats.clarity.model.CombatLogEntry;
import skadistats.clarity.processor.gameevents.OnCombatLogEntry;
import skadistats.clarity.processor.runner.SimpleRunner;
import skadistats.clarity.source.MappedFileSource;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Locale;

/** Parses a Dota replay with Clarity and writes a stable JSON adapter response. */
public final class ClarityWorker {
    private static final Gson GSON = new GsonBuilder().disableHtmlEscaping().setPrettyPrinting().create();
   private static final int MAX_EVENTS = 10_000;
    private final JsonArray events = new JsonArray();
    private long totalEvents = 0;

    @OnCombatLogEntry
    public void onCombatLogEntry(CombatLogEntry entry) {
        totalEvents++;
        if (events.size() >= MAX_EVENTS) return;
        JsonObject event = new JsonObject();
        event.addProperty("time", Math.max(0, entry.getTimestamp()));
        event.addProperty("type", entry.getType() == null ? "UNKNOWN" : entry.getType().name().toLowerCase(Locale.ROOT));
        put(event, "attacker", entry.getAttackerName());
        put(event, "target", entry.getTargetName());
        put(event, "ability", entry.getInflictorName());
        event.addProperty("value", entry.getValue());
        event.addProperty("x", entry.getLocationX());
        event.addProperty("y", entry.getLocationY());
        event.addProperty("attacker_team", entry.getAttackerTeam());
        events.add(event);
    }

    private static void put(JsonObject obj, String key, String value) {
        if (value != null && !value.isBlank()) obj.addProperty(key, value);
    }

    private static void diagnoseReplay(Path replay) throws Exception {
        System.err.println("========== REPLAY DIAGNOSTICS ==========");
        System.err.println("Replay path: " + replay);
        System.err.println("Replay size: " + Files.size(replay) + " bytes");
        byte[] header = new byte[16];
        try (InputStream input = Files.newInputStream(replay)) {
            int count = input.read(header);
            if (count > 0) {
                System.err.println("Replay header HEX: " + java.util.HexFormat.of().formatHex(header, 0, count));
                System.err.println("Replay header ASCII: " + new String(header, 0, count, StandardCharsets.US_ASCII).replaceAll("[^\\x20-\\x7E]", "."));
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
        if (!Files.isRegularFile(replay)) throw new IllegalArgumentException("Replay file does not exist: " + replay);
        Files.createDirectories(outputDir);
        diagnoseReplay(replay);
        ClarityWorker worker = new ClarityWorker();
        long start = System.nanoTime();
        try (MappedFileSource source = new MappedFileSource(replay.toString())) {
            new SimpleRunner(source).runWith(worker);
        }
        JsonObject result = new JsonObject();
        result.addProperty("parser", "Clarity");
        result.addProperty("parser_version", "4.0.1");
        result.addProperty("event_type", "combat_log");
        result.addProperty("events_total", worker.totalEvents);
        result.addProperty("events_returned", worker.events.size());
        result.addProperty("truncated", worker.totalEvents > worker.events.size());
        result.addProperty("parse_time_ms", (System.nanoTime() - start) / 1_000_000L);
        result.add("events", worker.events);
        Files.writeString(outputDir.resolve("parsed-events.json"), GSON.toJson(result), StandardCharsets.UTF_8);
    }
}
