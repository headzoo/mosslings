import type { WorldEvent } from "@/lib/god/types";
export function EventLog({ events }: { events: WorldEvent[] }) {
  return (
    <section className="event-log panel" aria-label="Event log">
      <h2>Event Log</h2>
      <ol>
        {events.map((event, index) => (
          <li
            key={event.id}
            className={index === 0 ? "recent-event" : undefined}
          >
            <h3>Year {event.year}</h3>
            <p>{event.message}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
