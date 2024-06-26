var gdjs;
(function (r) {
  const h = new r.Logger("RuntimeScene"),
    d = new r.Logger("RuntimeScene (setup warnings)");
  class c extends r.RuntimeInstanceContainer {
    constructor(t) {
      super();
      this._eventsFunction = null;
      this._lastId = 0;
      this._name = "";
      this._gameStopRequested = !1;
      this._requestedScene = "";
      this._asyncTasksManager = new r.AsyncTasksManager();
      this._isLoaded = !1;
      this._isJustResumed = !1;
      this._backgroundColor = 0;
      this._clearCanvas = !0;
      this._profiler = null;
      this._onProfilerStopped = null;
      (this._runtimeGame = t),
        (this._variables = new r.VariablesContainer()),
        (this._timeManager = new r.TimeManager()),
        (this._onceTriggers = new r.OnceTriggers()),
        (this._requestedChange = l.CONTINUE),
        (this._cachedGameResolutionWidth = t ? t.getGameResolutionWidth() : 0),
        (this._cachedGameResolutionHeight = t
          ? t.getGameResolutionHeight()
          : 0),
        (this._renderer = new r.RuntimeSceneRenderer(
          this,
          t ? t.getRenderer() : null
        )),
        (this._debuggerRenderer = new r.DebuggerRenderer(this)),
        this.onGameResolutionResized();
    }
    addLayer(t) {
      const e = new r.Layer(t, this);
      this._layers.put(t.name, e), this._orderedLayers.push(e);
    }
    onGameResolutionResized() {
      const t = this.getViewportOriginX(),
        e = this.getViewportOriginY();
      (this._cachedGameResolutionWidth = this._runtimeGame
        ? this._runtimeGame.getGameResolutionWidth()
        : 0),
        (this._cachedGameResolutionHeight = this._runtimeGame
          ? this._runtimeGame.getGameResolutionHeight()
          : 0);
      for (const i in this._layers.items)
        this._layers.items.hasOwnProperty(i) &&
          this._layers.items[i].onGameResolutionResized(t, e);
      this._renderer.onGameResolutionResized();
    }
    loadFromScene(t) {
      if (!t) {
        h.error("loadFromScene was called without a scene");
        return;
      }
      this._isLoaded && this.unloadScene(),
        this._runtimeGame &&
          this._runtimeGame.getRenderer().setWindowTitle("Bonk Russh"),
        (this._name = t.name),
        this.setBackgroundColor(t.r, t.v, t.b);
      for (let i = 0, s = t.layers.length; i < s; ++i)
        this.addLayer(t.layers[i]);
      this._variables = new r.VariablesContainer(t.variables);
      for (let i = 0, s = t.behaviorsSharedData.length; i < s; ++i) {
        const o = t.behaviorsSharedData[i];
        this.setInitialSharedDataForBehavior(o.name, o);
      }
      const e = this.getGame().getInitialObjectsData();
      for (let i = 0, s = e.length; i < s; ++i) this.registerObject(e[i]);
      for (let i = 0, s = t.objects.length; i < s; ++i)
        this.registerObject(t.objects[i]);
      if (
        (this.createObjectsFrom(t.instances, 0, 0, 0, !0),
        this._setLayerDefaultZOrders(),
        this.setEventsGeneratedCodeFunction(t),
        (this._onceTriggers = new r.OnceTriggers()),
        this._runtimeGame && !this._runtimeGame.wasFirstSceneLoaded())
      )
        for (let i = 0; i < r.callbacksFirstRuntimeSceneLoaded.length; ++i)
          r.callbacksFirstRuntimeSceneLoaded[i](this);
      for (let i = 0; i < r.callbacksRuntimeSceneLoaded.length; ++i)
        r.callbacksRuntimeSceneLoaded[i](this);
      t.stopSoundsOnStartup &&
        this._runtimeGame &&
        this._runtimeGame.getSoundManager().clearAll(),
        (this._isLoaded = !0),
        this._timeManager.reset();
    }
    getInitialSharedDataForBehavior(t) {
      const e = super.getInitialSharedDataForBehavior(t);
      return (
        e || h.error("Can't find shared data for behavior with name: " + t), e
      );
    }
    onPause() {
      const t = this.getAdhocListOfAllInstances();
      for (let e = 0, i = t.length; e < i; ++e) t[e].onScenePaused(this);
      for (let e = 0; e < r.callbacksRuntimeScenePaused.length; ++e)
        r.callbacksRuntimeScenePaused[e](this);
    }
    onResume() {
      this._isJustResumed = !0;
      const t = this.getAdhocListOfAllInstances();
      for (let e = 0, i = t.length; e < i; ++e) t[e].onSceneResumed(this);
      for (let e = 0; e < r.callbacksRuntimeSceneResumed.length; ++e)
        r.callbacksRuntimeSceneResumed[e](this);
    }
    unloadScene() {
      if (!this._isLoaded) return;
      this._profiler && this.stopProfiler();
      for (let e = 0; e < r.callbacksRuntimeSceneUnloading.length; ++e)
        r.callbacksRuntimeSceneUnloading[e](this);
      const t = this.getAdhocListOfAllInstances();
      for (let e = 0, i = t.length; e < i; ++e) {
        const s = t[e];
        s.onDeletedFromScene(this), s.onDestroyed();
      }
      this._renderer && this._renderer.onSceneUnloaded();
      for (let e = 0; e < r.callbacksRuntimeSceneUnloaded.length; ++e)
        r.callbacksRuntimeSceneUnloaded[e](this);
      this._destroy(), (this._isLoaded = !1), this.onGameResolutionResized();
    }
    _destroy() {
      super._destroy(),
        (this._variables = new r.VariablesContainer()),
        (this._initialBehaviorSharedData = new Hashtable()),
        (this._eventsFunction = null),
        (this._lastId = 0),
        (this._onceTriggers = null);
    }
    setEventsGeneratedCodeFunction(t) {
      const e = r[t.mangledName + "Code"];
      e && e.func
        ? (this._eventsFunction = e.func)
        : (d.warn("No function found for running logic of scene " + this._name),
          (this._eventsFunction = function () {}));
    }
    setEventsFunction(t) {
      this._eventsFunction = t;
    }
    renderAndStep(t) {
      this._profiler && this._profiler.beginFrame(),
        (this._requestedChange = l.CONTINUE),
        this._timeManager.update(t, this._runtimeGame.getMinimalFramerate()),
        this._profiler &&
          this._profiler.begin("asynchronous actions (wait action, etc...)"),
        this._asyncTasksManager.processTasks(this),
        this._profiler &&
          this._profiler.end("asynchronous actions (wait action, etc...)"),
        this._profiler && this._profiler.begin("objects (pre-events)"),
        this._updateObjectsPreEvents(),
        this._profiler && this._profiler.end("objects (pre-events)"),
        this._profiler &&
          this._profiler.begin("callbacks and extensions (pre-events)");
      for (let e = 0; e < r.callbacksRuntimeScenePreEvents.length; ++e)
        r.callbacksRuntimeScenePreEvents[e](this);
      this._profiler &&
        this._profiler.end("callbacks and extensions (pre-events)"),
        this._profiler && this._profiler.begin("events"),
        this._eventsFunction !== null && this._eventsFunction(this),
        this._profiler && this._profiler.end("events"),
        this._profiler && this._profiler.begin("objects (post-events)"),
        this._updateObjectsPostEvents(),
        this._profiler && this._profiler.end("objects (post-events)"),
        this._profiler &&
          this._profiler.begin("callbacks and extensions (post-events)");
      for (let e = 0; e < r.callbacksRuntimeScenePostEvents.length; ++e)
        r.callbacksRuntimeScenePostEvents[e](this);
      return (
        this._profiler &&
          this._profiler.end("callbacks and extensions (post-events)"),
        this._profiler &&
          this._profiler.begin("objects (pre-render, effects update)"),
        this._updateObjectsPreRender(),
        this._profiler &&
          this._profiler.end("objects (pre-render, effects update)"),
        this._profiler && this._profiler.begin("layers (effects update)"),
        this._updateLayersPreRender(),
        this._profiler && this._profiler.end("layers (effects update)"),
        this._profiler && this._profiler.begin("render"),
        this._debugDrawEnabled &&
          this._debuggerRenderer.renderDebugDraw(
            this.getAdhocListOfAllInstances(),
            this._debugDrawShowHiddenInstances,
            this._debugDrawShowPointsNames,
            this._debugDrawShowCustomPoints
          ),
        (this._isJustResumed = !1),
        this.render(),
        this._profiler && this._profiler.end("render"),
        this._profiler && this._profiler.endFrame(),
        !!this.getRequestedChange()
      );
    }
    render() {
      this._renderer.render();
    }
    _updateObjectsPreRender() {
      if (this._timeManager.isFirstFrame()) {
        super._updateObjectsPreRender();
        return;
      } else {
        this._updateLayersCameraCoordinates(2);
        const t = this.getAdhocListOfAllInstances();
        for (let e = 0, i = t.length; e < i; ++e) {
          const s = t[e],
            o = s.getRendererObject();
          if (o) {
            if (s.isHidden()) o.visible = !1;
            else {
              const n = this._layersCameraCoordinates[s.getLayer()];
              if (!n) continue;
              const a = s.getVisibilityAABB();
              o.visible =
                !a ||
                !(
                  a.min[0] > n[2] ||
                  a.min[1] > n[3] ||
                  a.max[0] < n[0] ||
                  a.max[1] < n[1]
                );
            }
            o.visible &&
              (this._runtimeGame
                .getEffectsManager()
                .updatePreRender(s.getRendererEffects(), s),
              s.updatePreRender(this));
          } else s.updatePreRender(this);
        }
      }
    }
    setBackgroundColor(t, e, i) {
      this._backgroundColor = parseInt(r.rgbToHex(t, e, i), 16);
    }
    getBackgroundColor() {
      return this._backgroundColor;
    }
    setClearCanvas(t) {
      this._clearCanvas = t;
    }
    getClearCanvas() {
      return this._clearCanvas;
    }
    getName() {
      return this._name;
    }
    createNewUniqueId() {
      return this._lastId++, this._lastId;
    }
    getRenderer() {
      return this._renderer;
    }
    getDebuggerRenderer() {
      return this._debuggerRenderer;
    }
    getGame() {
      return this._runtimeGame;
    }
    getScene() {
      return this;
    }
    getViewportWidth() {
      return this._cachedGameResolutionWidth;
    }
    getViewportHeight() {
      return this._cachedGameResolutionHeight;
    }
    getViewportOriginX() {
      return this._cachedGameResolutionWidth / 2;
    }
    getViewportOriginY() {
      return this._cachedGameResolutionHeight / 2;
    }
    convertCoords(t, e, i) {
      const s = i || [0, 0];
      return (s[0] = t), (s[1] = e), s;
    }
    convertInverseCoords(t, e, i) {
      const s = i || [0, 0];
      return (s[0] = t), (s[1] = e), s;
    }
    onChildrenLocationChanged() {}
    getVariables() {
      return this._variables;
    }
    getTimeManager() {
      return this._timeManager;
    }
    getElapsedTime() {
      return this._timeManager.getElapsedTime();
    }
    getSoundManager() {
      return this._runtimeGame.getSoundManager();
    }
    getAsyncTasksManager() {
      return this._asyncTasksManager;
    }
    getRequestedChange() {
      return this._requestedChange;
    }
    getRequestedScene() {
      return this._requestedScene;
    }
    requestChange(t, e) {
      (this._requestedChange = t), e && (this._requestedScene = e);
    }
    getProfiler() {
      return this._profiler;
    }
    startProfiler(t) {
      this._profiler ||
        ((this._profiler = new r.Profiler()), (this._onProfilerStopped = t));
    }
    stopProfiler() {
      if (!this._profiler) return;
      const t = this._profiler,
        e = this._onProfilerStopped;
      (this._profiler = null), (this._onProfilerStopped = null), e && e(t);
    }
    getOnceTriggers() {
      return this._onceTriggers;
    }
    sceneJustResumed() {
      return this._isJustResumed;
    }
  }
  r.RuntimeScene = c;
  let l;
  (function (n) {
    (n[(n.CONTINUE = 0)] = "CONTINUE"),
      (n[(n.PUSH_SCENE = 1)] = "PUSH_SCENE"),
      (n[(n.POP_SCENE = 2)] = "POP_SCENE"),
      (n[(n.REPLACE_SCENE = 3)] = "REPLACE_SCENE"),
      (n[(n.CLEAR_SCENES = 4)] = "CLEAR_SCENES"),
      (n[(n.STOP_GAME = 5)] = "STOP_GAME");
  })((l = r.SceneChangeRequest || (r.SceneChangeRequest = {})));
})(gdjs || (gdjs = {}));
//# sourceMappingURL=runtimescene.js.map
