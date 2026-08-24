/* ============================================================
   GITHUB SYNC — browser-safe GitHub REST API client used by the
   AI CEO self-edit feature. Reads file SHAs and commits small
   content updates straight from the browser (contents read/write
   permission on the qimmah-command-center repo). The token never
   leaves this device except in direct calls to api.github.com.
   ============================================================ */
const GH_API = "https://api.github.com";

function ghHeaders(gh) {
  return {
    Authorization: "Bearer " + gh.token,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

function ghUrl(gh, path) {
  return GH_API + "/repos/" + gh.owner + "/" + gh.repo + "/contents/" + path.split("/").map(encodeURIComponent).join("/");
}

async function ghError(res) {
  let detail = "";
  try { const j = await res.json(); detail = j && j.message ? String(j.message) : ""; } catch (e) { /* non-JSON body */ }
  if (res.status === 401) return new Error("GitHub rejected the token (401). Check that the personal access token is valid and not expired.");
  if (res.status === 403) return new Error("GitHub refused access (403). The token needs Contents: Read and write on " + "the repository." + (detail ? " (" + detail.slice(0, 120) + ")" : ""));
  if (res.status === 404) return new Error("Repo or file not found (404). Check owner/repo/branch in the GitHub card." + (detail ? " (" + detail.slice(0, 120) + ")" : ""));
  return new Error("GitHub returned error " + res.status + "." + (detail ? " (" + detail.slice(0, 140) + ")" : ""));
}

/* UTF-8 safe base64 encode/decode (atob/btoa are Latin-1 only). */
function toB64(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 8192) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192));
  return btoa(bin);
}
function fromB64(b64) {
  const bin = atob(String(b64 || "").replace(/\s/g, ""));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/* Test the token + repo settings. Returns the repo full name on success. */
export async function testGhConnection(gh) {
  const res = await fetch(GH_API + "/repos/" + gh.owner + "/" + gh.repo, { headers: ghHeaders(gh) });
  if (!res.ok) throw await ghError(res);
  const j = await res.json();
  return j.full_name || gh.owner + "/" + gh.repo;
}

/* Fetch one file's sha + decoded content from the working branch.
   Returns { sha: null, content: "" } when the file does not exist yet. */
export async function getFileSha(gh, path) {
  const res = await fetch(ghUrl(gh, path) + "?ref=" + encodeURIComponent(gh.branch || "main"), { headers: ghHeaders(gh) });
  if (res.status === 404) return { sha: null, content: "" };
  if (!res.ok) throw await ghError(res);
  const j = await res.json();
  if (Array.isArray(j) || j.type !== "file") throw new Error(path + " is not a file on branch " + (gh.branch || "main") + ".");
  return { sha: j.sha, content: fromB64(j.content) };
}

/* Commit one or more file updates as individual commits on the branch.
   files: [{ path, content }] — full new file contents.
   On a 409/422 sha conflict the sha is refetched once and retried. */
export async function commitFiles(gh, message, files) {
  const committed = [];
  for (const f of files) {
    let sha = (await getFileSha(gh, f.path)).sha;
    for (let attempt = 0; attempt < 2; attempt++) {
      const res = await fetch(ghUrl(gh, f.path), {
        method: "PUT",
        headers: { ...ghHeaders(gh), "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          content: toB64(f.content),
          branch: gh.branch || "main",
          ...(sha ? { sha } : {}),
        }),
      });
      if (res.ok) {
        const j = await res.json();
        committed.push({ path: f.path, sha: j.commit && j.commit.sha });
        break;
      }
      if ((res.status === 409 || res.status === 422) && attempt === 0) {
        sha = (await getFileSha(gh, f.path)).sha; // refetch once, then retry
        continue;
      }
      throw await ghError(res);
    }
  }
  return committed;
}
