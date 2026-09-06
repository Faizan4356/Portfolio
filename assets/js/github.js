/* Shared GitHub data layer: unauthenticated api.github.com calls only.
   Every fetch is try/caught with a static fallback so the page never looks
   broken offline or rate-limited. Results are cached in sessionStorage
   (5 min TTL) so navigating between pages in the same tab doesn't refetch.
   Consumers listen for CustomEvents on `window` rather than calling fetch
   themselves: gh:user, gh:events, gh:repo:<name>, gh:signal. */
(function (global) {
  "use strict";

  var GH_USER = "Faizan4356";
  var TTL_MS = 5 * 60 * 1000;

  var FALLBACK_USER = { followers: 6, public_repos: 8, live: false };
  var FALLBACK_EVENTS = { items: [], live: false };
  var REPO_FALLBACKS = {
    "SmokeGuard": { stars: 2, updated: "2026-08-20T00:00:00Z" },
    "AI-Powered-Data-Analyst": { stars: 3, updated: "2026-08-25T00:00:00Z" },
    "Gender-Classification": { stars: 1, updated: "2026-07-30T00:00:00Z" },
    "3D-StyleForge": { stars: 2, updated: "2026-08-10T00:00:00Z" },
    "Excel-to--Dashboard": { stars: 1, updated: "2026-08-01T00:00:00Z" },
    "churn-prediction-app": { stars: 4, updated: "2026-08-28T00:00:00Z" },
    "pk-job-tracker": { stars: 2, updated: "2026-09-01T00:00:00Z" },
    "sales-forecasting-project": { stars: 3, updated: "2026-08-15T00:00:00Z" }
  };

  function cacheGet(key) {
    try {
      var raw = sessionStorage.getItem(key);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (Date.now() - parsed.t > TTL_MS) return null;
      return parsed.v;
    } catch (e) {
      return null;
    }
  }
  function cacheSet(key, value) {
    try {
      sessionStorage.setItem(key, JSON.stringify({ t: Date.now(), v: value }));
    } catch (e) {}
  }

  function emit(name, detail) {
    global.dispatchEvent(new CustomEvent(name, { detail: detail }));
  }

  function relativeTime(iso) {
    var diff = Date.now() - new Date(iso).getTime();
    var mins = Math.round(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return mins + "m ago";
    var hrs = Math.round(mins / 60);
    if (hrs < 24) return hrs + "h ago";
    var days = Math.round(hrs / 24);
    if (days < 30) return days + "d ago";
    var months = Math.round(days / 30);
    return months + "mo ago";
  }

  function computeSignal(mostRecentIso) {
    if (!mostRecentIso) return 0.35;
    var hrs = (Date.now() - new Date(mostRecentIso).getTime()) / 3600000;
    if (hrs < 6) return 1;
    if (hrs < 24) return 0.8;
    if (hrs < 24 * 7) return 0.55;
    return 0.3;
  }

  function fetchUser() {
    var cached = cacheGet("gh:user");
    if (cached) { emit("gh:user", cached); return Promise.resolve(cached); }
    return fetch("https://api.github.com/users/" + GH_USER)
      .then(function (r) { if (!r.ok) throw new Error("rate-limited"); return r.json(); })
      .then(function (data) {
        var out = { followers: data.followers, public_repos: data.public_repos, live: true };
        cacheSet("gh:user", out);
        emit("gh:user", out);
        return out;
      })
      .catch(function () {
        emit("gh:user", FALLBACK_USER);
        return FALLBACK_USER;
      });
  }

  function fetchEvents() {
    var cached = cacheGet("gh:events");
    if (cached) { emit("gh:events", cached); emitSignalFromEvents(cached); return Promise.resolve(cached); }
    return fetch("https://api.github.com/users/" + GH_USER + "/events/public")
      .then(function (r) { if (!r.ok) throw new Error("rate-limited"); return r.json(); })
      .then(function (data) {
        var items = (data || []).slice(0, 3).map(function (ev) {
          return {
            type: ev.type,
            repo: ev.repo && ev.repo.name ? ev.repo.name.split("/")[1] : "repo",
            created_at: ev.created_at
          };
        });
        var out = { items: items, live: true };
        cacheSet("gh:events", out);
        emit("gh:events", out);
        emitSignalFromEvents(out);
        return out;
      })
      .catch(function () {
        emit("gh:events", FALLBACK_EVENTS);
        emitSignalFromEvents(FALLBACK_EVENTS);
        return FALLBACK_EVENTS;
      });
  }

  function emitSignalFromEvents(eventsPayload) {
    var mostRecent = eventsPayload.items && eventsPayload.items[0] ? eventsPayload.items[0].created_at : null;
    var value = computeSignal(mostRecent);
    document.documentElement.style.setProperty("--signal-intensity", String(value));
    emit("gh:signal", { value: value, live: eventsPayload.live });
  }

  function fetchRepo(repoName) {
    var key = "gh:repo:" + repoName;
    var cached = cacheGet(key);
    if (cached) { emit(key, cached); return Promise.resolve(cached); }
    return fetch("https://api.github.com/repos/" + GH_USER + "/" + repoName)
      .then(function (r) { if (!r.ok) throw new Error("rate-limited"); return r.json(); })
      .then(function (data) {
        var out = { stars: data.stargazers_count, updated: data.pushed_at, live: true };
        cacheSet(key, out);
        emit(key, out);
        return out;
      })
      .catch(function () {
        var fb = REPO_FALLBACKS[repoName] || { stars: 0, updated: null };
        var out = { stars: fb.stars, updated: fb.updated, live: false };
        emit(key, out);
        return out;
      });
  }

  function typeLabel(type) {
    var map = {
      PushEvent: "push",
      CreateEvent: "create",
      PullRequestEvent: "pull-request",
      IssuesEvent: "issue",
      WatchEvent: "star",
      ForkEvent: "fork",
      PublicEvent: "publish",
      IssueCommentEvent: "comment"
    };
    return map[type] || type.replace("Event", "").toLowerCase();
  }

  global.FaizanGH = {
    fetchUser: fetchUser,
    fetchEvents: fetchEvents,
    fetchRepo: fetchRepo,
    relativeTime: relativeTime,
    typeLabel: typeLabel
  };

  document.addEventListener("DOMContentLoaded", function () {
    fetchUser();
    fetchEvents();
  });
})(window);
