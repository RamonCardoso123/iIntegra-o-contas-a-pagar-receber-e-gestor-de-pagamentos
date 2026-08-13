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
  /** Permite digitar valores negativos (ex: Saldo em Caixa, quando a
   * conta está no vermelho). Por padrão os campos de valor continuam só
   * aceitando positivo — não faz sentido uma conta a pagar negativa. */
  permiteNegativo?: boolean
}

/**
 * Campo de valor em reais com máscara ao vivo (estilo calculadora): os
 * dígitos digitados vão se acumulando da direita pra esquerda como
 * centavos, então digitar "9900000" vira "99.000,00" na hora — nunca
 * mostra o número cru sem separador de milhar/decimal.
 */
function formatarCentavos(digitosBrutos: string, negativo: boolean): string {
  const somenteDigitos = digitosBrutos.replace(/\D/g, '')
  const numero = somenteDigitos === '' ? 0 : parseInt(somenteDigitos, 10)
  const valor = (numero / 100) * (negativo ? -1 : 1)
  return valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function paraCentavos(valor: number): string {
  return String(Math.round(Math.abs(valor || 0) * 100))
}

function textoParaNumero(texto: string): number {
  const n = parseFloat(texto.replace(/\./g, '').replace(',', '.'))
  return isNaN(n) ? 0 : n
}

export default function InputMoeda({ value, onChange, className, placeholder, disabled, autoFocus, onBlur, id, title, permiteNegativo }: InputMoedaProps) {
  const [texto, setTexto] = useState(() => formatarCentavos(paraCentavos(value), value < 0))

  useEffect(() => {
    // sincroniza quando o valor externo muda (ex: reset de formulário,
    // preenchimento automático pela IA, edição de outro item)
    const centavosExternos = paraCentavos(value)
    const negativoExterno = value < 0
    const atual = textoParaNumero(texto)
    const centavosAtuais = paraCentavos(atual)
    const negativoAtual = atual < 0
    if (centavosExternos !== centavosAtuais || negativoExterno !== negativoAtual) {
      setTexto(formatarCentavos(centavosExternos, negativoExterno))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    // O "-" pode aparecer em qualquer posição do texto digitado — trata
    // como um alternador de sinal (se tiver "-" em qualquer lugar, o
    // valor final fica negativo), só quando permiteNegativo está ligado.
    const negativo = !!permiteNegativo && e.target.value.includes('-')
    const formatado = formatarCentavos(e.target.value, negativo)
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
