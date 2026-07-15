'use client'

import { memo } from 'react'

// Memoiza o conteúdo pesado de uma seção da ficha. Só re-renderiza quando algo
// em `deps` muda (referência da fatia da ficha daquela seção + readonly + erros).
// Sem isto, cada tecla digitada re-renderiza TODAS as ~25 seções (centenas de
// inputs) → delay perceptível. Com isto, só a seção editada re-renderiza.
//
// O `children` é recriado a cada render do pai, mas o comparador ignora `children`
// e compara só `deps`: quando `deps` não muda, o conteúdo anterior é reaproveitado
// (a fatia da ficha tem a mesma referência, então é seguro).

type Props = {
  deps: unknown[]
  children: React.ReactNode
}

function depsIguais(a: unknown[], b: unknown[]): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (!Object.is(a[i], b[i])) return false
  }
  return true
}

export const SecaoMemo = memo(
  function SecaoMemo({ children }: Props) {
    return <>{children}</>
  },
  (prev, next) => depsIguais(prev.deps, next.deps),
)
