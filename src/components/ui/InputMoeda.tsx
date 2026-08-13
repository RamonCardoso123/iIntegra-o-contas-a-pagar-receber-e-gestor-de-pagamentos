"use client"

import { useEffect, useState } from 'react'

interface InputMoedaProps {
  value: number
  onChange: (valor: number) => void
  className?: string
  placeholder?: string
  disabled?: boolean
  autoFocus?: boolean
  onBlur?: () => void
  id?: string
  title?: string
}

/**
 * Campo de valor em reais com máscara ao vivo (estilo calculadora): os
 * dígitos digitados vão se acumulando da direita pra esquerda como
 * centavos, então digitar "9900000" vira "99.000,00" na hora — nunca
 * mostra o número cru sem separador de milhar/decimal.
 */
function formatarCentavos(digitosBrutos: string): string {
  const somenteDigitos = digitosBrutos.replace(/\D/g, '')
  const numero = somenteDigitos === '' ? 0 : parseInt(somenteDigitos, 10)
  const valor = numero / 100
  return valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function paraCentavos(valor: number): string {
  return String(Math.round((valor || 0) * 100))
}

function textoParaNumero(texto: string): number {
  const n = parseFloat(texto.replace(/\./g, '').replace(',', '.'))
  return isNaN(n) ? 0 : n
}

export default function InputMoeda({ value, onChange, className, placeholder, disabled, autoFocus, onBlur, id, title }: InputMoedaProps) {
  const [texto, setTexto] = useState(() => formatarCentavos(paraCentavos(value)))

  useEffect(() => {
    // sincroniza quando o valor externo muda (ex: reset de formulário,
    // preenchimento automático pela IA, edição de outro item)
    const centavosExternos = paraCentavos(value)
    const centavosAtuais = String(Math.round(textoParaNumero(texto) * 100))
    if (centavosExternos !== centavosAtuais) {
      setTexto(formatarCentavos(centavosExternos))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const formatado = formatarCentavos(e.target.value)
    setTexto(formatado)
    onChange(textoParaNumero(formatado))
  }

  return (
    <input
      id={id}
      type="text"
      inputMode="decimal"
      value={texto}
      onChange={handleChange}
      onFocus={e => e.target.select()}
      onBlur={onBlur}
      placeholder={placeholder || '0,00'}
      disabled={disabled}
      autoFocus={autoFocus}
      className={className}
      title={title}
    />
  )
}
