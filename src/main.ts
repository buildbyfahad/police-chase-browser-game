import './style.css';
import { GameManager } from './game/GameManager';

const root = document.getElementById('game-root');
if (!root) throw new Error('#game-root is missing from index.html');

new GameManager(root);

// Block the pull-to-refresh / rubber-band scroll that would otherwise fight
// with steering gestures on mobile.
document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
document.addEventListener('gesturestart', (e) => e.preventDefault());
