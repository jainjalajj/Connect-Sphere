/**
 * VirtualBackgroundPanel
 *
 * A slide-up panel for selecting background effect:
 *   - None (pass-through)
 *   - Blur (light / medium / heavy)
 *   - Solid colour presets
 *   - Built-in image presets (gradient data URIs — no external URLs)
 *   - Custom image upload
 */

import React, { useRef } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Tooltip,
  Divider,
  Slider,
  Button,
  Chip,
  CircularProgress,
} from '@mui/material';
import {
  Close as CloseIcon,
  BlurOn as BlurIcon,
  Block as NoneIcon,
  Palette as ColorIcon,
  Image as ImageIcon,
  Upload as UploadIcon,
} from '@mui/icons-material';

// ── Preset solid colours ───────────────────────────────────────────────────
const COLOR_PRESETS = [
  { label: 'Navy', color: '#1a1a2e' },
  { label: 'Forest', color: '#1b4332' },
  { label: 'Plum', color: '#3d1a4e' },
  { label: 'Slate', color: '#1c2541' },
  { label: 'Charcoal', color: '#2b2d42' },
  { label: 'Teal', color: '#0d3b47' },
  { label: 'Burgundy', color: '#4a0e0e' },
  { label: 'Midnight', color: '#0a0a1a' },
];

// ── Gradient virtual background presets (pure CSS → data URI, no CDN) ─────
const buildGradientDataURI = (gradient, w = 320, h = 180) => {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  const stops = gradient;
  const gr = ctx.createLinearGradient(0, 0, w, h);
  stops.forEach(([offset, color]) => gr.addColorStop(offset, color));
  ctx.fillStyle = gr;
  ctx.fillRect(0, 0, w, h);
  return canvas.toDataURL();
};

const GRADIENT_PRESETS = [
  { label: 'Aurora', stops: [[0, '#0f0c29'], [0.5, '#302b63'], [1, '#24243e']] },
  { label: 'Ocean', stops: [[0, '#1a1a2e'], [0.5, '#16213e'], [1, '#0f3460']] },
  { label: 'Sunset', stops: [[0, '#f7971e'], [0.5, '#ffd200'], [1, '#f7971e']] },
  { label: 'Forest', stops: [[0, '#0f2027'], [0.5, '#203a43'], [1, '#2c5364']] },
  { label: 'Rose', stops: [[0, '#f953c6'], [1, '#b91d73']] },
  { label: 'Emerald', stops: [[0, '#11998e'], [1, '#38ef7d']] },
];

// ─────────────────────────────────────────────────────────────────────────────

const PanelSection = ({ title, children }) => (
  <Box sx={{ mb: 2 }}>
    <Typography variant="overline" color="text.secondary" sx={{ display: 'block', mb: 1, letterSpacing: 1 }}>
      {title}
    </Typography>
    {children}
  </Box>
);

function VirtualBackgroundPanel({ currentBg, onSetBackground, isLoading, error, onClose }) {
  const fileInputRef = useRef(null);

  const isActive = (type, extra = {}) => {
    if (currentBg.type !== type) return false;
    return Object.entries(extra).every(([k, v]) => currentBg[k] === v);
  };

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      onSetBackground({ type: 'image', src: ev.target.result });
    };
    reader.readAsDataURL(file);
    // Reset input so same file can be re-selected
    e.target.value = '';
  };

  return (
    <Box
      sx={{
        width: { xs: '100%', md: 320 },
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'background.paper',
        borderLeft: '1px solid rgba(255,255,255,0.08)',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <Box sx={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        p: 2, borderBottom: '1px solid rgba(255,255,255,0.08)',
        flexShrink: 0,
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <BlurIcon color="primary" fontSize="small" />
          <Typography variant="subtitle1" fontWeight={700}>
            Background Effects
          </Typography>
        </Box>
        <IconButton size="small" onClick={onClose}><CloseIcon fontSize="small" /></IconButton>
      </Box>

      {/* Loading / error banners */}
      {isLoading && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1, backgroundColor: 'rgba(88,101,242,0.15)' }}>
          <CircularProgress size={14} />
          <Typography variant="caption" color="primary.light">Loading AI model…</Typography>
        </Box>
      )}
      {error && (
        <Box sx={{ px: 2, py: 1, backgroundColor: 'rgba(237,66,69,0.15)' }}>
          <Typography variant="caption" color="error.light">{error}</Typography>
        </Box>
      )}

      {/* Scrollable content */}
      <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>

        {/* ── None ── */}
        <PanelSection title="Off">
          <Box
            onClick={() => onSetBackground({ type: 'none' })}
            sx={{
              display: 'flex', alignItems: 'center', gap: 1.5,
              p: 1.5, borderRadius: 2, cursor: 'pointer',
              border: '2px solid',
              borderColor: currentBg.type === 'none' ? 'primary.main' : 'transparent',
              backgroundColor: currentBg.type === 'none'
                ? 'rgba(88,101,242,0.15)' : 'rgba(255,255,255,0.04)',
              '&:hover': { backgroundColor: 'rgba(255,255,255,0.08)' },
              transition: 'all 0.15s',
            }}
          >
            <NoneIcon fontSize="small" color={currentBg.type === 'none' ? 'primary' : 'disabled'} />
            <Typography variant="body2">No effect (raw camera)</Typography>
            {currentBg.type === 'none' && <Chip label="Active" size="small" color="primary" sx={{ ml: 'auto', height: 18, fontSize: 10 }} />}
          </Box>
        </PanelSection>

        <Divider sx={{ my: 1.5, borderColor: 'rgba(255,255,255,0.08)' }} />

        {/* ── Blur ── */}
        <PanelSection title="Background Blur">
          <Box sx={{ display: 'flex', gap: 1, mb: 1.5 }}>
            {[
              { label: 'Light', radius: 4 },
              { label: 'Medium', radius: 10 },
              { label: 'Heavy', radius: 20 },
            ].map(({ label, radius }) => (
              <Box
                key={label}
                onClick={() => onSetBackground({ type: 'blur', radius })}
                sx={{
                  flex: 1, py: 1.5, borderRadius: 2, cursor: 'pointer',
                  textAlign: 'center',
                  border: '2px solid',
                  borderColor: isActive('blur', { radius }) ? 'primary.main' : 'transparent',
                  backgroundColor: isActive('blur', { radius })
                    ? 'rgba(88,101,242,0.2)' : 'rgba(255,255,255,0.04)',
                  '&:hover': { backgroundColor: 'rgba(255,255,255,0.08)' },
                  transition: 'all 0.15s',
                }}
              >
                <BlurIcon
                  sx={{ fontSize: 20, opacity: 0.3 + (radius / 25), color: isActive('blur', { radius }) ? 'primary.main' : 'text.secondary' }}
                />
                <Typography variant="caption" display="block" color={isActive('blur', { radius }) ? 'primary.main' : 'text.secondary'}>
                  {label}
                </Typography>
              </Box>
            ))}
          </Box>

          {/* Custom blur radius slider */}
          {currentBg.type === 'blur' && (
            <Box sx={{ px: 1 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography variant="caption" color="text.secondary">Custom blur</Typography>
                <Typography variant="caption" color="primary.main" fontWeight={700}>{currentBg.radius}px</Typography>
              </Box>
              <Slider
                value={currentBg.radius}
                min={2}
                max={25}
                step={1}
                size="small"
                onChange={(_, v) => onSetBackground({ type: 'blur', radius: v })}
                sx={{ color: 'primary.main' }}
              />
            </Box>
          )}
        </PanelSection>

        <Divider sx={{ my: 1.5, borderColor: 'rgba(255,255,255,0.08)' }} />

        {/* ── Solid colours ── */}
        <PanelSection title="Solid Color">
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {COLOR_PRESETS.map(({ label, color }) => (
              <Tooltip key={color} title={label}>
                <Box
                  onClick={() => onSetBackground({ type: 'color', color })}
                  sx={{
                    width: 36, height: 36, borderRadius: 1.5,
                    backgroundColor: color, cursor: 'pointer',
                    border: '2px solid',
                    borderColor: isActive('color', { color }) ? 'primary.main' : 'transparent',
                    boxShadow: isActive('color', { color }) ? '0 0 0 2px rgba(88,101,242,0.5)' : 'none',
                    transition: 'all 0.15s',
                    '&:hover': { transform: 'scale(1.12)' },
                  }}
                />
              </Tooltip>
            ))}
          </Box>
        </PanelSection>

        <Divider sx={{ my: 1.5, borderColor: 'rgba(255,255,255,0.08)' }} />

        {/* ── Gradient backgrounds ── */}
        <PanelSection title="Virtual Background">
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {GRADIENT_PRESETS.map(({ label, stops }) => {
              const src = buildGradientDataURI(stops);
              const active = currentBg.type === 'image' && currentBg.label === label;
              return (
                <Tooltip key={label} title={label}>
                  <Box
                    onClick={() => onSetBackground({ type: 'image', src, label })}
                    sx={{
                      width: 72, height: 40, borderRadius: 1.5, overflow: 'hidden',
                      cursor: 'pointer', flexShrink: 0,
                      backgroundImage: `url(${src})`,
                      backgroundSize: 'cover',
                      border: '2px solid',
                      borderColor: active ? 'primary.main' : 'transparent',
                      boxShadow: active ? '0 0 0 2px rgba(88,101,242,0.5)' : 'none',
                      transition: 'all 0.15s',
                      '&:hover': { transform: 'scale(1.06)' },
                    }}
                  />
                </Tooltip>
              );
            })}
          </Box>

          {/* Custom image upload */}
          <Box sx={{ mt: 1.5 }}>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleImageUpload}
            />
            <Button
              variant="outlined"
              size="small"
              fullWidth
              startIcon={<UploadIcon />}
              onClick={() => fileInputRef.current?.click()}
              sx={{ borderColor: 'rgba(255,255,255,0.2)', color: 'text.secondary' }}
            >
              Upload custom image
            </Button>
            {currentBg.type === 'image' && currentBg.src?.startsWith('data:') && !currentBg.label && (
              <Typography variant="caption" color="success.main" sx={{ display: 'block', mt: 0.5, textAlign: 'center' }}>
                ✓ Custom image active
              </Typography>
            )}
          </Box>
        </PanelSection>

        {/* Performance note */}
        <Box sx={{ mt: 2, p: 1.5, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 2 }}>
          <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.6 }}>
            💡 Background effects use your GPU. If you notice lag, try a lighter blur or disable effects.
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}

export default VirtualBackgroundPanel;
