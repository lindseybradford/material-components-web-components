/**
@license
Copyright 2018 Google Inc. All Rights Reserved.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/
import {directive, PropertyPart, noChange, NodePart, templateFactory} from 'lit-html';
import MDCRippleFoundation from '@material/ripple/foundation.js';
import {MDCRippleAdapter} from '@material/ripple/adapter.js';
import {style} from './mwc-ripple-global-css.js';
import {supportsCssVariables} from '@material/ripple/util.js';
import {applyPassive} from '@material/dom/events'
import {matches} from '@material/dom/ponyfill';

import {EventType, SpecificEventListener} from '@material/mwc-base/base-element.js';

const supportsCssVariablesWin = supportsCssVariables(window);

export interface RippleOptions {
  interactionNode?: HTMLElement;
  unbounded?: boolean;
  disabled?: boolean;
  active?: boolean;
}

export interface RippleNodeOptions extends RippleOptions {
  surfaceNode: HTMLElement;
}

// NOTE: This is a workaround for https://bugs.webkit.org/show_bug.cgi?id=173027.
// Since keyframes on pseudo-elements (:after) are not supported in Shadow DOM,
// we put the keyframe style into the <head> element.
const isSafari = navigator.userAgent.match(/Safari/);
let didApplyRippleStyle = false;
const applyRippleStyle = () => {
  didApplyRippleStyle = true;
  const part = new NodePart({templateFactory});
  part.appendInto(document.head!);
  part.setValue(style);
  part.commit();
};

/**
 * Applied a ripple to the node specified by {surfaceNode}.
 * @param options {RippleNodeOptions}
 */
export const rippleNode = (options: RippleNodeOptions) => {
  if (isSafari && !didApplyRippleStyle) {
    applyRippleStyle();
  }
  // TODO(sorvell): This directive requires bringing css yourself. We probably need to do this
  // because of ShadyCSS, but on Safari, the keyframes styling must be global. Perhaps this
  // directive could fix that.
  const surfaceNode = options.surfaceNode;
  const interactionNode = options.interactionNode || surfaceNode;
  // only style interaction node if not in the same root
  if (interactionNode.getRootNode() !== surfaceNode.getRootNode()) {
    if (interactionNode.style.position === '') {
      interactionNode.style.position = 'relative';
    }
  }
  const adapter: MDCRippleAdapter = {
    browserSupportsCssVars: () => supportsCssVariablesWin,
    isUnbounded: () =>
      options.unbounded === undefined ? true : options.unbounded,
    isSurfaceActive: () => matches(interactionNode, ':active'),
    isSurfaceDisabled: () => Boolean(options.disabled),
    addClass: (className: string) => surfaceNode.classList.add(className),
    removeClass: (className: string) =>
      surfaceNode.classList.remove(className),
    containsEventTarget: (target: HTMLElement) => interactionNode.contains(target),
    registerInteractionHandler: <K extends EventType>(type: K, handler: SpecificEventListener<K>) =>
      interactionNode.addEventListener(type, handler, applyPassive()),
    deregisterInteractionHandler: <K extends EventType>(type: K, handler: SpecificEventListener<K>) =>
      interactionNode.removeEventListener(type, handler, applyPassive()),
    registerDocumentInteractionHandler: <K extends EventType>(evtType: K, handler: SpecificEventListener<K>) =>
      document.documentElement!.addEventListener(
          evtType, handler, applyPassive()),
    deregisterDocumentInteractionHandler: <K extends EventType>(evtType: string, handler: SpecificEventListener<K>) =>
      document.documentElement!.removeEventListener(
          evtType, handler as EventListenerOrEventListenerObject, applyPassive()),
    registerResizeHandler: (handler: SpecificEventListener<'resize'>) =>
      window.addEventListener('resize', handler),
    deregisterResizeHandler: (handler: SpecificEventListener<'resize'>) =>
      window.removeEventListener('resize', handler),
    updateCssVariable: (varName: string, value: string) =>
      surfaceNode.style.setProperty(varName, value),
    computeBoundingRect: () => surfaceNode.getBoundingClientRect(),
    getWindowPageOffset: () => ({x: window.pageXOffset, y: window.pageYOffset}),
  };
  const rippleFoundation = new MDCRippleFoundation(adapter);
  rippleFoundation.init();
  return rippleFoundation;
}

const rippleInteractionNodes = new WeakMap();

/**
 * A directive that applies a Material ripple to a part node. The directive
 * should be applied to a PropertyPart.
 * @param options {RippleOptions}
 */
export const ripple = directive((options: RippleOptions = {}) => (part: PropertyPart) => {
  const surfaceNode = part.committer.element as HTMLElement;
  const interactionNode = options.interactionNode || surfaceNode;
  let rippleFoundation = (part.value as any);
  // if the interaction node changes, destroy and invalidate the foundation.
  const existingInteractionNode = rippleInteractionNodes.get(rippleFoundation);
  if (existingInteractionNode !== undefined && existingInteractionNode !== interactionNode) {
    rippleFoundation.destroy();
    rippleFoundation = noChange;
  }
  // make the ripple, if needed
  if (rippleFoundation === noChange) {
    rippleFoundation = rippleNode(Object.assign({}, options, {surfaceNode}));
    rippleInteractionNodes.set(rippleFoundation, interactionNode);
    part.setValue(rippleFoundation);
  // otherwise update settings as needed.
  } else {
    if (options.unbounded !== undefined) {
      rippleFoundation.setUnbounded(options.unbounded);
    }
    if (options.disabled !== undefined) {
      rippleFoundation.setUnbounded(options.disabled);
    }
  }
  if (options.active === true) {
    rippleFoundation.activate();
  } else if (options.active === false) {
    rippleFoundation.deactivate();
  }
});
