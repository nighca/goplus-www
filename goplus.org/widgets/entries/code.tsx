import React from 'react'
import CodeBlock, { CodeSegmentInfo as Segment } from 'components/Code/Block'
import { defineWidget, getAttr, getBoolAttr, isElementNode, isTextNode } from '../widget'

/**
 * Usage:
 * 
 * ```html
 * <xgo-code>
 *   <xgo-code-doc>
 *     Strings, which can be added together with +.
 *   </xgo-code-doc>
 *   println "Go"+"Plus"
 *   <xgo-code-doc>
 *     Integers and floats.
 *   </xgo-code-doc>
 *   println "1+1 =", 1+1
 *   println "7.0/3.0 =", 7.0/3.0
 * </xgo-code>
 * ```
 */

defineWidget('code', el => {
  const segments: Segment[] = []

  let segment: Segment | null = null

  function sealSegment() {
    if (segment == null) return
    if (!segment.content) return
    segments.push(segment)
  }

  Array.from(el.childNodes).forEach(node => {
    if (isElementNode(node) && node.tagName.endsWith('-CODE-DOC')) {
      sealSegment()
      segment = {
        content: '',
        doc: <p dangerouslySetInnerHTML={{ __html: node.innerHTML }} />
      }
    }
    if (isTextNode(node)) {
      if (segment == null) segment = { content: '' }
      segment.content += node.wholeText
    }
  })
  sealSegment()

  return (
    <CodeBlock
      code={segments}
      language={getAttr(el, 'language')}
      copyable={getBoolAttr(el, 'copyable')}
      runnable={getBoolAttr(el, 'runnable')}
      editable={getBoolAttr(el, 'editable')}
      halfCode={getBoolAttr(el, 'half-code')}
    />
  )
})
