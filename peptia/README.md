# PEPTIA - Engineered for Performance

PEPTIA is a performance-focused e-commerce platform and landing page designed for athletes who take their training seriously. This repository contains the front-end code for the main landing page, product showcase, and the administrative dashboard.

## Project Structure

- `index.html`: The main landing page showcasing the brand, products, why choose PEPTIA, and delivery information.
- `peptia-panel-7x.html`: The administrative dashboard for managing products, WhatsApp numbers, and other site settings.
- `style.css` & `global.css`: Styling for the main landing page.
- `admin.css`: Styling for the administrative dashboard.
- `script.js`: Core interactivity for the landing page, including product loading, WhatsApp integration, and UI animations.
- `admin.js`: Functionality for the admin dashboard (e.g., product management, syncing with data).
- `shared.js`: Shared utilities across the application.
- `retatrutide_products.json`: The data source for the products displayed on the site.

## Features

- **Dynamic Product Loading:** Products are loaded dynamically from a JSON file.
- **WhatsApp Integration:** Seamless ordering and inquiries via WhatsApp, with a configurable number managed via the admin panel.
- **Responsive Design:** Optimized for both desktop and mobile devices.
- **Admin Dashboard:** A panel to manage stock, pricing, and settings.
- **AI Chatbot Interface:** Built-in UI for a customer support assistant.

## Setup and Usage

1. Clone or download the repository.
2. Serve the directory using a local web server (e.g., VS Code Live Server, `python -m http.server`) to avoid CORS issues when fetching the JSON data.
3. Access `index.html` to view the landing page.
4. Access `peptia-panel-7x.html` to manage the site's data.

## Technologies Used

- HTML5
- CSS3 (Vanilla)
- JavaScript (Vanilla)
- JSON for data storage
