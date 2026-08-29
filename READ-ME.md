# Race to 15

A read-only league table for the goals sweepstake. Nineteen teams, three Premier
League players each, closest to 15 goals by 31 December wins.

The site is a static page. Goal counts live in `goals.json`, which is rewritten
every night by a GitHub Action. Nothing on the page can write to it, so a visitor
can't change a number no matter what they open in devtools — the only write path
is a commit to this repo.

## Setting it up

1. **Create the repo.** New public repository on GitHub, upload these files,
   keeping the folder structure.

2. **Get a stats key.** Register free at <https://www.football-data.org/client/register>.
   A key arrives by email.

3. **Store the key.** Repo → Settings → Secrets and variables → Actions → New
   repository secret. Name it exactly `FOOTBALL_DATA_TOKEN`, paste the key.

4. **Turn the site on.** Settings → Pages → Source: *Deploy from a branch*,
   branch `main`, folder `/ (root)`. A minute later your link is live at
   `https://YOURNAME.github.io/REPONAME/`.

5. **Test the updater.** Actions tab → *Update goals* → *Run workflow*. It should
   finish green and list any changes. If it fails, the log says why.

That's it. It then runs itself at 03:15 UTC nightly.

## Fixing a wrong number

Edit `overrides.json` in GitHub and commit:

```json
{ "overrides": { "thiago": 4 } }
```

Anything in there beats the fetched value on the next run. Delete the entry to
hand the player back to the automatic count. This is your admin panel — it needs
your GitHub login, so nobody else in the group can touch it.

## Things worth knowing

- **The free tier returns the top 100 scorers.** Anyone outside that is recorded
  as 0. Early season that's correct. If the list ever truncates below your
  players, you'll see totals stop moving — check with `Run workflow` and read
  the log.
- **Surname-only players are the risk.** Igor Thiago and Gabriel Magalhães are
  the two most likely to mismatch. If either sits on 0 while you know he's
  scored, add the API's spelling to his `aliases` in `players.json`.
- **The script refuses to lower the total** goal count mid-season without an
  override, so a bad API response can't quietly wipe the table.
- **It freezes itself on 1 January.** The 03:15 run on 1 Jan captures everything
  through 31 December, then every run after that exits without writing. The final
  table stays put.
- **Changing the deadline or the target** means editing `FREEZE` in
  `scripts/update-goals.mjs` and the `15` in `index.html`.
