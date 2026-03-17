/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter as Router } from 'react-router-dom';
import AppRoutes from './routes.tsx';
import './store/darkModeStore.ts'; // Initialize dark mode globally

export default function App() {
  return (
    <Router>
      <AppRoutes />
    </Router>
  );
}
