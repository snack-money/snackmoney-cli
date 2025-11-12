# Required GitHub Secrets for Publishing

This document lists all the secrets required for the GitHub Actions workflows to publish the Snack Money CLI.

## Required Secrets

Add these secrets in your GitHub repository: **Settings > Secrets and variables > Actions > New repository secret**

### 1. NPM_TOKEN (Required for npm publishing)

**Workflow:** `.github/workflows/publish-npm.yml`

**What it does:** Allows GitHub Actions to publish packages to npm registry

**How to get it:**

1. Go to https://www.npmjs.com/
2. Log in to your account
3. Click on your profile picture → **Access Tokens**
4. Click **Generate New Token** → **Classic Token**
5. Select **Automation** type (recommended for CI/CD)
6. Copy the generated token
7. Add it to GitHub secrets as `NPM_TOKEN`

**Token type:** Automation token (recommended) or Publish token

---

### 2. HOMEBREW_TAP_TOKEN (Required for Homebrew formula updates)

**Workflow:** `.github/workflows/release.yml`

**What it does:** Allows GitHub Actions to update the Homebrew formula in your homebrew-tap repository

**How to get it:**

1. Go to https://github.com/settings/tokens
2. Click **Generate new token** → **Generate new token (classic)**
3. Give it a descriptive name: "Homebrew Tap Update Token"
4. Set expiration (recommend: 90 days or No expiration for automation)
5. Select scopes:
   - ✅ **repo** (Full control of private repositories)
   - This gives access to push to the homebrew-tap repository
6. Click **Generate token**
7. Copy the token (you won't be able to see it again!)
8. Add it to GitHub secrets as `HOMEBREW_TAP_TOKEN`

**Important:** This token needs write access to the `snack-money/homebrew-tap` repository

**Alternative:** You can also use a fine-grained personal access token with specific repository access

---

## Summary

### Secrets to Add Manually:

1. ✅ `NPM_TOKEN` - from npmjs.com
2. ✅ `HOMEBREW_TAP_TOKEN` - from github.com/settings/tokens

---

## Testing the Workflows

After adding all secrets, test the workflows by creating and pushing a new tag:

```bash
# Create a new tag
git tag -a v1.0.1 -m "Release version 1.0.1"

# Push the tag
git push origin v1.0.1
```

This will automatically:
1. ✅ Publish to npm
2. ✅ Update Homebrew formula

---

## Troubleshooting

### Workflow fails with "Error: Process completed with exit code 1"

**Check:**
1. Verify all secrets are correctly set
2. Check secret names match exactly (case-sensitive)
3. Verify tokens haven't expired
4. Check token permissions are sufficient

### npm publish fails

**Check:**
1. `NPM_TOKEN` is set correctly
2. Token has publish permissions
3. Package name is not already taken
4. Package version in `package.json` is bumped

### Homebrew update fails

**Check:**
1. `HOMEBREW_TAP_TOKEN` has write access to homebrew-tap repo
2. Repository `snack-money/homebrew-tap` exists
3. Formula file exists at `Formula/snackmoney.rb`

---

## Security Best Practices

1. **Rotate tokens regularly** - Update tokens every 90 days
2. **Use minimum required permissions** - Don't grant more access than needed
3. **Monitor token usage** - Check GitHub Actions logs for suspicious activity
4. **Revoke unused tokens** - Remove tokens that are no longer needed
5. **Use organization secrets** - If working in an organization, use organization-level secrets

---

## Additional Resources

- [GitHub Actions Secrets Documentation](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
- [npm Access Tokens](https://docs.npmjs.com/creating-and-viewing-access-tokens)
- [GitHub Personal Access Tokens](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token)
