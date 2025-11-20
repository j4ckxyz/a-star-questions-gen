# A* Question Generator

A simple web application to generate random graph problems for practicing Dijkstra's Algorithm and A* Search Algorithm.

**Live Demo:** [https://a-star-gen.pages.dev/](https://a-star-gen.pages.dev/)

## Features

- **Random Graph Generation**: Generates connected graphs with random nodes and edge weights.
- **Difficulty Levels**: Choose between Easy (fewer nodes) and Hard (more nodes, complex connections).
- **Visual Interface**: Interactive canvas to visualize the graph.
- **Worksheet Generation**: Automatically generates a table for tracking $g(n)$, $h(n)$, and $f(n)$ values, copyable to Notion/Markdown.
- **Responsive Design**: Works on desktop and mobile devices.

## Deployment

This project is designed to be deployed on **Cloudflare Pages**.

### Steps:

1.  Fork or Clone this repository.
2.  Log in to the [Cloudflare Dashboard](https://dash.cloudflare.com/).
3.  Go to **Workers & Pages** > **Create Application** > **Pages** > **Connect to Git**.
4.  Select this repository.
5.  **Build Settings**:
    - **Framework Preset**: None / Static HTML
    - **Build Command**: (Leave empty)
    - **Build Output Directory**: `/` (Root)
6.  Click **Save and Deploy**.

Your site will be live in seconds!
