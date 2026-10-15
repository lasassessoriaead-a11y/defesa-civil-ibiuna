import React, { useRef } from 'react'
import {
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Sparkles,
  RotateCcw,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

interface RichEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  onAiReviewRequest?: () => void
  isAiLoading?: boolean
}

export const RichEditor: React.FC<RichEditorProps> = ({
  value,
  onChange,
  placeholder = 'Digite o texto do documento oficial...',
  disabled = false,
  onAiReviewRequest,
  isAiLoading = false,
}) => {
  const editorRef = useRef<HTMLDivElement>(null)

  // Sincronizar o valor inicial se o editor estiver vazio
  React.useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      if (document.activeElement !== editorRef.current) {
        editorRef.current.innerHTML = value || ''
      }
    }
  }, [value])

  const handleInput = () => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML)
    }
  }

  const exec = (command: string, arg: string | undefined = undefined) => {
    if (disabled) return
    document.execCommand(command, false, arg)
    if (editorRef.current) {
      editorRef.current.focus()
      onChange(editorRef.current.innerHTML)
    }
  }

  return (
    <div className="border border-slate-300 rounded-md overflow-hidden bg-white focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500 transition-all">
      {/* Barra de Ferramentas */}
      <div className="flex flex-wrap items-center justify-between gap-1 p-1.5 bg-slate-50 border-b border-slate-200">
        <div className="flex items-center gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-slate-700 hover:bg-slate-200"
            onClick={() => exec('bold')}
            disabled={disabled}
            title="Negrito"
          >
            <Bold className="w-4 h-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-slate-700 hover:bg-slate-200"
            onClick={() => exec('italic')}
            disabled={disabled}
            title="Itálico"
          >
            <Italic className="w-4 h-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-slate-700 hover:bg-slate-200"
            onClick={() => exec('underline')}
            disabled={disabled}
            title="Sublinhado"
          >
            <Underline className="w-4 h-4" />
          </Button>

          <div className="h-4 w-px bg-slate-300 mx-1" />

          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-slate-700 hover:bg-slate-200"
            onClick={() => exec('insertUnorderedList')}
            disabled={disabled}
            title="Lista com marcadores"
          >
            <List className="w-4 h-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-slate-700 hover:bg-slate-200"
            onClick={() => exec('insertOrderedList')}
            disabled={disabled}
            title="Lista numerada"
          >
            <ListOrdered className="w-4 h-4" />
          </Button>

          <div className="h-4 w-px bg-slate-300 mx-1" />

          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-slate-700 hover:bg-slate-200"
            onClick={() => exec('justifyLeft')}
            disabled={disabled}
            title="Alinhar à esquerda"
          >
            <AlignLeft className="w-4 h-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-slate-700 hover:bg-slate-200"
            onClick={() => exec('justifyCenter')}
            disabled={disabled}
            title="Centralizar"
          >
            <AlignCenter className="w-4 h-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-slate-700 hover:bg-slate-200"
            onClick={() => exec('justifyRight')}
            disabled={disabled}
            title="Alinhar à direita"
          >
            <AlignRight className="w-4 h-4" />
          </Button>
        </div>

        {onAiReviewRequest && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={disabled || isAiLoading}
            onClick={onAiReviewRequest}
            className="h-8 text-xs bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100 hover:text-purple-800 gap-1.5 shadow-xs font-medium"
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-600 animate-pulse" />
            {isAiLoading ? 'Analisando com IA...' : 'Revisar com IA'}
          </Button>
        )}
      </div>

      {/* Área Editável */}
      <div
        ref={editorRef}
        contentEditable={!disabled}
        onInput={handleInput}
        className={`p-4 min-h-[220px] max-h-[500px] overflow-y-auto focus:outline-none prose prose-slate max-w-none text-slate-900 text-sm leading-relaxed ${
          disabled ? 'bg-slate-50 cursor-not-allowed text-slate-500' : ''
        }`}
        data-placeholder={placeholder}
      />
    </div>
  )
}
