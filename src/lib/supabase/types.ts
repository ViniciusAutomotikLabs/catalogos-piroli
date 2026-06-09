export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      catalogos: {
        Row: {
          arquivo_path: string | null
          criado_em: string | null
          erro_resumo: string | null
          id: number
          imagens_count: number | null
          nome_exibicao: string | null
          produtos_count: number | null
          slug: string
          status: string | null
          tipo_fonte: string | null
          ultimo_job_em: string | null
        }
        Insert: {
          arquivo_path?: string | null
          criado_em?: string | null
          erro_resumo?: string | null
          id?: number
          imagens_count?: number | null
          nome_exibicao?: string | null
          produtos_count?: number | null
          slug: string
          status?: string | null
          tipo_fonte?: string | null
          ultimo_job_em?: string | null
        }
        Update: {
          arquivo_path?: string | null
          criado_em?: string | null
          erro_resumo?: string | null
          id?: number
          imagens_count?: number | null
          nome_exibicao?: string | null
          produtos_count?: number | null
          slug?: string
          status?: string | null
          tipo_fonte?: string | null
          ultimo_job_em?: string | null
        }
        Relationships: []
      }
      clientes: {
        Row: {
          ativo: boolean
          bairro: string | null
          cep: string | null
          cidade: string | null
          cnpj: string | null
          complemento: string | null
          contato_nome: string | null
          criado_em: string
          email: string | null
          especialidade: string | null
          id: number
          logradouro: string | null
          loja_id: number
          marcas: string[] | null
          nome_fantasia: string | null
          numero: string | null
          razao_social: string
          telefone_whatsapp: string | null
          uf: string | null
          ultima_compra_em: string | null
        }
        Insert: {
          ativo?: boolean
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          cnpj?: string | null
          complemento?: string | null
          contato_nome?: string | null
          criado_em?: string
          email?: string | null
          especialidade?: string | null
          id?: never
          logradouro?: string | null
          loja_id: number
          marcas?: string[] | null
          nome_fantasia?: string | null
          numero?: string | null
          razao_social: string
          telefone_whatsapp?: string | null
          uf?: string | null
          ultima_compra_em?: string | null
        }
        Update: {
          ativo?: boolean
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          cnpj?: string | null
          complemento?: string | null
          contato_nome?: string | null
          criado_em?: string
          email?: string | null
          especialidade?: string | null
          id?: never
          logradouro?: string | null
          loja_id?: number
          marcas?: string[] | null
          nome_fantasia?: string | null
          numero?: string | null
          razao_social?: string
          telefone_whatsapp?: string | null
          uf?: string | null
          ultima_compra_em?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clientes_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
        ]
      }
      fabricantes: {
        Row: {
          codigo_original_fornecedor: string | null
          id: number
          nome_fabricante: string
          origem_catalogo: string
        }
        Insert: {
          codigo_original_fornecedor?: string | null
          id?: number
          nome_fabricante: string
          origem_catalogo: string
        }
        Update: {
          codigo_original_fornecedor?: string | null
          id?: number
          nome_fabricante?: string
          origem_catalogo?: string
        }
        Relationships: []
      }
      historico_consultas: {
        Row: {
          contexto_veiculo: string | null
          criado_em: string
          id: number
          loja_id: number
          produto_id: number | null
          termo: string | null
          user_id: string | null
        }
        Insert: {
          contexto_veiculo?: string | null
          criado_em?: string
          id?: never
          loja_id: number
          produto_id?: number | null
          termo?: string | null
          user_id?: string | null
        }
        Update: {
          contexto_veiculo?: string | null
          criado_em?: string
          id?: never
          loja_id?: number
          produto_id?: number | null
          termo?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "historico_consultas_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "historico_consultas_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      ingestao_jobs: {
        Row: {
          catalogo_slug: string
          duracao_seg: number | null
          finalizado_em: string | null
          id: number
          imagens_enviadas: number | null
          iniciado_em: string | null
          log_resumo: string | null
          produtos_inseridos: number | null
          status: string | null
        }
        Insert: {
          catalogo_slug: string
          duracao_seg?: number | null
          finalizado_em?: string | null
          id?: number
          imagens_enviadas?: number | null
          iniciado_em?: string | null
          log_resumo?: string | null
          produtos_inseridos?: number | null
          status?: string | null
        }
        Update: {
          catalogo_slug?: string
          duracao_seg?: number | null
          finalizado_em?: string | null
          id?: number
          imagens_enviadas?: number | null
          iniciado_em?: string | null
          log_resumo?: string | null
          produtos_inseridos?: number | null
          status?: string | null
        }
        Relationships: []
      }
      lojas: {
        Row: {
          cnpj: string | null
          criado_em: string
          id: number
          logo_url: string | null
          nome: string
          telefone_whatsapp: string | null
        }
        Insert: {
          cnpj?: string | null
          criado_em?: string
          id?: never
          logo_url?: string | null
          nome: string
          telefone_whatsapp?: string | null
        }
        Update: {
          cnpj?: string | null
          criado_em?: string
          id?: never
          logo_url?: string | null
          nome?: string
          telefone_whatsapp?: string | null
        }
        Relationships: []
      }
      membros_loja: {
        Row: {
          criado_em: string
          loja_id: number
          papel: string
          user_id: string
        }
        Insert: {
          criado_em?: string
          loja_id: number
          papel?: string
          user_id: string
        }
        Update: {
          criado_em?: string
          loja_id?: number
          papel?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "membros_loja_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
        ]
      }
      orcamento_itens: {
        Row: {
          criado_em: string
          descricao_avulsa: string | null
          id: number
          orcamento_id: number
          preco_unitario: number
          produto_id: number | null
          quantidade: number
        }
        Insert: {
          criado_em?: string
          descricao_avulsa?: string | null
          id?: never
          orcamento_id: number
          preco_unitario?: number
          produto_id?: number | null
          quantidade?: number
        }
        Update: {
          criado_em?: string
          descricao_avulsa?: string | null
          id?: never
          orcamento_id?: number
          preco_unitario?: number
          produto_id?: number | null
          quantidade?: number
        }
        Relationships: [
          {
            foreignKeyName: "orcamento_itens_orcamento_id_fkey"
            columns: ["orcamento_id"]
            isOneToOne: false
            referencedRelation: "orcamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orcamento_itens_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      orcamentos: {
        Row: {
          atualizado_em: string
          cliente_id: number | null
          criado_em: string
          criado_por: string | null
          id: number
          loja_id: number
          status: string
          validade_dias: number
        }
        Insert: {
          atualizado_em?: string
          cliente_id?: number | null
          criado_em?: string
          criado_por?: string | null
          id?: never
          loja_id: number
          status?: string
          validade_dias?: number
        }
        Update: {
          atualizado_em?: string
          cliente_id?: number | null
          criado_em?: string
          criado_por?: string | null
          id?: never
          loja_id?: number
          status?: string
          validade_dias?: number
        }
        Relationships: [
          {
            foreignKeyName: "orcamentos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orcamentos_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
        ]
      }
      produtos: {
        Row: {
          codigo_produto_interno: string
          criado_em: string | null
          descricao: string | null
          fabricante_id: number | null
          foto_url: string | null
          id: number
          numero_produto: string | null
          observacoes: string | null
          origem_catalogo: string
          unidade: string | null
        }
        Insert: {
          codigo_produto_interno: string
          criado_em?: string | null
          descricao?: string | null
          fabricante_id?: number | null
          foto_url?: string | null
          id?: number
          numero_produto?: string | null
          observacoes?: string | null
          origem_catalogo: string
          unidade?: string | null
        }
        Update: {
          codigo_produto_interno?: string
          criado_em?: string | null
          descricao?: string | null
          fabricante_id?: number | null
          foto_url?: string | null
          id?: number
          numero_produto?: string | null
          observacoes?: string | null
          origem_catalogo?: string
          unidade?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "produtos_fabricante_id_fkey"
            columns: ["fabricante_id"]
            isOneToOne: false
            referencedRelation: "fabricantes"
            referencedColumns: ["id"]
          },
        ]
      }
      referencias_cruzadas: {
        Row: {
          fabricante_referencia: string | null
          id: number
          numero_referencia: string
          produto_id: number | null
        }
        Insert: {
          fabricante_referencia?: string | null
          id?: number
          numero_referencia: string
          produto_id?: number | null
        }
        Update: {
          fabricante_referencia?: string | null
          id?: number
          numero_referencia?: string
          produto_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "referencias_cruzadas_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never
