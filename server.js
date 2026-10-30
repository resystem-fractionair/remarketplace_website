/* Local entry point: `npm start` → http://localhost:3000 (Vercel uses api/index.js instead). */
const app = require('./server/app');
const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`reMarketplace running on http://localhost:${port}`));
