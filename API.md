# API & Route Specifications

This document outlines the internal routing structure and API endpoints provided by Legacy Gateway.

---

## 1. Proxy & Navigation Routes

### `GET /p/<scheme>/<host>/<path>`
- **Description**: Primary proxy handler. Intercepts, rewrites, and forwards HTTP/HTTPS requests to upstream web servers.
- **Parameters**:
  - `<scheme>`: `http` or `https`
  - `<host>`: Target domain (e.g., `www.example.com`)
  - `<path>`: Resource path on target domain
- **Behavior**:
  - Validates SSRF safety.
  - Attaches encrypted cookie jars.
  - Performs HTML, CSS, JavaScript, and image transformations.
  - Returns legacy-compatible responses.

### `GET /navigate`
- **Description**: Handles inputs from the main URL address bar and redirects to the appropriate proxy path.
- **Query Parameters**:
  - `q`: Target URL or search string (e.g., `example.com` or `apple news`)
  - `e` (optional): Search engine choice (`ddg`, `google`, `wikipedia`, `bing`). Default is `ddg`.
- **Response**: `302 Redirect` to `/p/<scheme>/<host>/<path>` or search engine results page.

---

## 2. Snapshot Mode Routes

### `GET /snap`
- **Description**: Main landing page for Snapshot Mode.
- **Behavior**: Checks if `BROWSERLESS_TOKEN` is configured and displays the remote browser address input form.

### `GET /snap/view`
- **Description**: Remote browser renderer route. Connects to cloud Chromium via Chrome DevTools Protocol.
- **Query Parameters**:
  - `u`: Target web address (e.g., `https://www.example.com`). Auto-prepends `https://` if missing.
  - `back` (optional): Set to `1` to navigate back in snapshot history.
  - `y` (optional): Vertical scroll position offset in pixels.
  - `tsel` (optional): CSS selector of target input element for remote interaction.
  - `tval` (optional): Text string to type into target input element.
  - `act` (optional): Action type (`click` or `type`).
  - `boxes` (optional): Set to `1` to highlight overlay tap targets.
- **Response**: Returns HTML page containing viewport screenshot image and transparent link/button overlays.

### `GET /snap/img`
- **Description**: Serves cached snapshot JPEG images.
- **Query Parameters**:
  - `id`: Unique screenshot cache identifier.
- **Response**: `image/jpeg` image payload.

### `GET /snap/type`
- **Description**: Render form input interaction keyboard interface for legacy devices.
- **Query Parameters**:
  - `u`: Target URL.
  - `sel`: CSS selector of form element.
  - `label`: Display label of form field.
- **Response**: HTML form page for submitting text back to the remote browser session.

---

## 3. Session & Gateway Administration Routes

### `GET /gate` / `POST /gate`
- **Description**: Access control key verification page.
- **Form Parameters (POST)**:
  - `key`: Access key string matching `LG_GATE_KEY`.
- **Response**: Sets session authentication cookie and redirects to `/`.

### `GET /settings` / `POST /settings`
- **Description**: Gateway user preferences configuration.
- **Settings Controlled**:
  - Default search engine
  - Image optimization quality
  - JavaScript transpilation toggle
  - Cookie jar clearing

### `GET /history`
- **Description**: Displays browsing history for the current session.

### `GET /bookmark`
- **Description**: Manage user bookmarks saved within the current gateway session.
