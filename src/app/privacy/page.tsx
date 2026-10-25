import type { Metadata } from "next";
import { PageHeader } from "@/components/honeycomb/page-header";

export const metadata: Metadata = {
  title: "Privacy · Busk Map",
  description: "What Busk Map stores, why, for how long, who can see it, and who else handles a request.",
};

const REPO = "https://github.com/T04435/busk-map";

type Item = { title: string; body: string[] };

/** Each card is plain statements about what the code does today. Where nothing deletes data automatically, it says so. */
const ITEMS: Item[] = [
  {
    title: "No accounts, no tracking",
    body: [
      "There is nothing to sign up for. Busk Map has no advertising, no analytics and no tracking cookies. Its one cookie is described below.",
    ],
  },
  {
    title: "Your Repertoire and its cookie",
    body: [
      "When you first save a Repertoire, Busk Map sets one cookie, buskmap_playlist. Browsing, and planning a busk without saving, set nothing. The cookie holds a random token that identifies this browser to the Repertoire and nothing else: no name, no email. It is HttpOnly (page scripts cannot read it), SameSite=Lax, Secure on the live site, and lasts 400 days from the last time it was refreshed. The database keeps only a hash of the token, never the token itself.",
      "The Repertoire holds what you enter or import: your act name, the artists you sound like, your Spotify artist link and the profile Busk Map fetched from it (name, pictures, genres, follower count), the songs you can play or have learned (title, artist, and where known the Spotify track, year, length and cover picture), the songs suggested to you and whether you accepted or dismissed them, your last few planned busks (the top pitch's name and map position, which are public places), and the latest research results. It is stored in the database so it follows this browser.",
      "Only this browser's cookie opens it. There is no way to look it up by name. A Repertoire not opened for 13 months is deleted; that clean-up runs when the site is used, not on an exact schedule. The step-by-step record of each Learn run is trimmed to the latest 5 runs and 30 days, and the oldest runs and dismissed suggestions are dropped once a Repertoire gets very large. You can delete your Repertoire yourself with Forget my Repertoire on the Repertoire page: it deletes the stored Repertoire, its songs, runs and suggestions, and clears the cookie.",
    ],
  },
  {
    title: "Saved plans and short links",
    body: [
      "Each plan gets a short link (/p/ and nine letters and numbers). The stored row holds the request exactly as you sent it (act name, artists, any Spotify artist ids, the songs you sent, the city, the time slot, your permit type and the score weights), the finished plan, and every step the Hive took with the data each tool returned, much of it from Qloo. It holds no cookie value, no IP address and no account, since there are none. The same request on the same day reuses the same link.",
      "Anyone who has the link can open the plan, and that includes your act name, artists and songs. The links are not listed or searchable, but they are not password protected either, so share one only with people you are happy to show it to. Plans have no automatic deletion yet: a saved plan stays until it is removed by hand.",
      "Two short-lived copies also exist so a busy plan can be replayed: finished runs and plain-AI comparison results are cached for about 15 minutes, keyed by a hash of the request. An expired copy is deleted the next time it is looked up, not on a timer, so an unused one can stay in the database longer.",
    ],
  },
  {
    title: "Counts and logs",
    body: [
      "To compare the Hive's picks with a plain AI's, Busk Map records for each plan the city, time slot, pitch ids, scores and how much the two overlap, plus a hash of the request. It holds no name and no text you typed. There is no automatic deletion yet.",
      "Two small tables count how many calls Busk Map has made to Spotify (per day) and when to pause calling it. They hold no personal data.",
      "Server logs are one line per event, with the event, a request id, model usage counts and error messages. Busk Map does not log your act name, artists, songs, cookie or IP address. Query strings are stripped from the web addresses it logs. Vercel, which hosts the site, keeps its own request logs that include IP addresses; Busk Map does not control those.",
    ],
  },
  {
    title: "Rate limits and your IP address",
    body: [
      "To stop abuse and runaway costs, Busk Map counts requests per IP address (for example, 30 new plans an hour, and 6 Learn runs an hour). The counts are held in the memory of the running server for up to an hour and are not written to the database. Vercel's firewall and BotID bot check also see your IP address and browser signals to tell people from scripts.",
    ],
  },
  {
    title: "Getting your data deleted",
    body: [
      "Your Repertoire: use Forget my Repertoire on the Repertoire page. It takes effect at once.",
      "A saved plan: Busk Map has no account to tie a plan to, so there is no delete button. Ask the author, T04435, through the project's page on GitHub (the link is in the footer), and include the plan's short link. It is removed by hand.",
      "Clearing this site's cookies in your browser disconnects the browser from its Repertoire. Without the cookie, the Repertoire can no longer be opened, but it stays stored until it expires or is deleted as above.",
    ],
  },
];

const THIRD_PARTIES: { name: string; body: string }[] = [
  {
    name: "Qloo",
    body: "Taste data. Receives artist names or ids, the city area and the genres or crowds being asked about. It does not receive your cookie, your IP address or your act name.",
  },
  {
    name: "Spotify",
    body: "Artist and song search, and your artist profile when you add a Spotify link. Receives the search text and artist or track ids. Cover pictures are loaded by your browser straight from Spotify's image servers.",
  },
  {
    name: "Last.fm",
    body: "Song popularity and top tracks. Receives artist names. Some pictures load from its servers.",
  },
  {
    name: "Vercel (hosting, BotID, AI Gateway)",
    body: "Runs the site and sees every request, including IP addresses. BotID checks that a request comes from a browser. AI Gateway carries the Hive's requests to the model provider.",
  },
  {
    name: "Anthropic (model provider)",
    body: "The company behind the language model the Hive runs on, reached through Vercel AI Gateway. Receives the text the Hive works from: your act name, artists and songs, the pitches being compared and the data its tools returned. It does not receive your cookie or IP address from Busk Map.",
  },
  {
    name: "Neon",
    body: "Hosts the Postgres database that holds everything described above.",
  },
  {
    name: "Open-Meteo, Ticketmaster, City of Melbourne",
    body: "City search, weather, events and the busking rules (the council's published zones and sites). Busk Map asks for a city or an area, never for anything about you.",
  },
  {
    name: "OpenFreeMap",
    body: "Map tiles and fonts. Your browser loads these directly, so OpenFreeMap sees your IP address and the part of the map you view.",
  },
];

export default function PrivacyPage() {
  return (
    <main id="main" className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-4 py-8 md:py-12">
      <PageHeader meta="Privacy" title="What Busk Map keeps" />
      <ul className="m-0 flex list-none flex-col gap-4 p-0">
        {ITEMS.map((item) => (
          <li key={item.title} className="flex flex-col gap-2 border-2 border-rule bg-card p-4">
            <h2 className="m-0 font-display text-[24px] leading-none font-extrabold uppercase">{item.title}</h2>
            {item.body.map((paragraph) => (
              <p key={paragraph} className="m-0 text-base leading-6">
                {paragraph}
              </p>
            ))}
          </li>
        ))}
      </ul>
      <section aria-labelledby="third-h" className="flex flex-col gap-3">
        <h2 id="third-h" className="m-0 font-display text-[28px] leading-none font-extrabold uppercase">
          Who else handles a request
        </h2>
        <p className="m-0 text-base leading-6 text-muted-foreground">
          Making a plan or a Repertoire involves these services. Each has its own privacy terms. Busk Map&apos;s server makes the calls, except the map tiles and
          pictures, which your browser loads itself.
        </p>
        <ul className="m-0 grid list-none gap-3 p-0 text-sm md:grid-cols-2">
          {THIRD_PARTIES.map((party) => (
            <li key={party.name} className="border border-border bg-card px-3 py-2">
              <span className="font-bold">{party.name}</span> <span className="text-muted-foreground">{party.body}</span>
            </li>
          ))}
        </ul>
        <p className="m-0 text-base leading-6">
          Busk Map is open source, so all of this can be checked in the{" "}
          <a className="font-bold underline underline-offset-3 hover:decoration-2" href={REPO} target="_blank" rel="noopener noreferrer">
            code
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
          .
        </p>
      </section>
    </main>
  );
}
