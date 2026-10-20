import './assets/fonts/pretendard/pretendard-variable-dynamic-subset.css';
import './ui/styles.css';
import { dropLegacyStorage } from './pages/legacy-storage';
import { startApp } from './ui/app';

dropLegacyStorage();
const root = document.getElementById('app');
if (root) startApp(root);
