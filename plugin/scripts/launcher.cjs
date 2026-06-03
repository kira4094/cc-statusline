var ovLabel = "chained";
          if (sl.includes("claude-hud")) ovLabel = "claude-hud";
          else if (sl.includes("claude-ds-hud")) ovLabel = "ds-hud";
          var ovIdx = chains.findIndex(function(x){return x.command===sl||x.label===ovLabel;});
          if (ovIdx >= 0) { chains[ovIdx].command = sl; chains[ovIdx].path = sl; }
          else { chains.push({ label: ovLabel, path: sl, command: sl, detected: new Date().toISOString() }); }          }
          sources.chains = chains;
          settings.statusLine = { type: "command", command: ourCmd };
          changed = true;
        }

        // 2. Auto-update chain paths when plugins version-bump
        for (let ci = 0; ci < (sources.chains || []).length; ci++) {
          const ch = sources.chains[ci];
          if (!ch.path) continue;
          const segs = ch.path.replace(/\\/g, "/").split("/");
          let verIdx = -1;
          for (let si = 0; si < segs.length; si++) {
            if (/^v?\d+\.\d+/.test(segs[si])) { verIdx = si; break; }
          }
          if (verIdx < 1) continue;
          const parent = segs.slice(0, verIdx).join("/");
          const scriptPath = segs.slice(verIdx + 1).join("/");
          let versions;
          try { versions = fs.readdirSync(parent).filter(d => /^v?\d/.test(d)).sort().reverse(); } catch { continue; }
          if (versions.length > 0 && versions[0] !== segs[verIdx]) {
            const newPath = parent + "/" + versions[0] + "/" + scriptPath;
            if (fs.existsSync(newPath)) {
              ch.path = newPath;
              ch.command = 'node "' + newPath + '"';
              changed = true;
            }
          }
        }

        if (changed) {
          fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + "\n");
          fs.writeFileSync(sourcesPath, JSON.stringify(sources, null, 2) + "\n");
        }
      }
    } catch {}
  }
}

main();
