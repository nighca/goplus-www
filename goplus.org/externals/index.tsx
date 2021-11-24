import './polyfill'

import React from 'react'
import ReactDOM from 'react-dom'
import RawHeader from 'components/Header'
import RawFooter from 'components/Footer'
import EnsureMounted from 'components/EnsureMounted'

import './style.scss'

const ExternalWrapper = EnsureMounted

class Header extends HTMLElement {
  constructor() {
    super()
  }

  connectedCallback() {
    const header = document.createElement('header')
    this.appendChild(header)
    ReactDOM.render(<ExternalWrapper><RawHeader /></ExternalWrapper>, header)
    this.style.height = ''
  }
}

class Footer extends HTMLElement {
  constructor() {
    super()
  }
  connectedCallback() {
    const footer = document.createElement('footer')
    this.appendChild(footer)
    ReactDOM.render(<ExternalWrapper><RawFooter /></ExternalWrapper>, footer)
  }
}

window.customElements.define('goplus-www-header', Header)
window.customElements.define('goplus-www-footer', Footer)
