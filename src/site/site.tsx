import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './site.css';
import Home from './Home';
import Unbuilt from './Unbuilt';
import Product from './Product';
import Jobs from './Jobs';

// Public site entry. Deliberately separate from the app: it never imports
// src/index.css, the app's theme hooks or Supabase, and its pages are not
// part of the app's offline precache.
const root = document.getElementById('lp-root')!;
const page = root.dataset.page ?? 'home';

createRoot(root).render(
  <StrictMode>
    {page === 'home' ? <Home /> : page === 'product' ? <Product /> : page === 'jobs' ? <Jobs /> : <Unbuilt page={page} />}
  </StrictMode>,
);
