# AMO 4.0.6 Reviewer Notes

4.0.6 fixes the `authenticationInfo` consent handling rejected in 4.0.5. Account requests require an explicit grant from
`browser.permissions.getAll().data_collection`. Sign-in requests consent from the user's click; denial blocks account
traffic, and revocation clears the session. Dislike counts work without signing in.

Build the supplied source with Node.js 22.17.0 and npm 10.8.2:

```sh
node scripts/build-firefox-source.mjs
```

Output: `Extensions/combined/dist/firefox`. The source rebuild matches the submitted package byte for byte.

To test premium statistics, select **Login with Patreon**, accept the optional consent, and use the account below.
Open a YouTube video to view the statistics. Revoke authentication consent in `about:addons` to verify sign-out.

```text
Login:
Password:
```
