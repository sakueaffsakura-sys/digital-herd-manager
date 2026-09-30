export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      animais: {
        Row: {
          created_at: string
          data_nascimento: string | null
          id: string
          lote_id: string | null
          mae_id: string | null
          nome: string | null
          numero_brinco: string
          observacoes: string | null
          pai_id: string | null
          propriedade_id: string
          raca: string | null
          sexo: Database["public"]["Enums"]["sexo_animal"]
          situacao: Database["public"]["Enums"]["situacao_animal"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          data_nascimento?: string | null
          id?: string
          lote_id?: string | null
          mae_id?: string | null
          nome?: string | null
          numero_brinco: string
          observacoes?: string | null
          pai_id?: string | null
          propriedade_id: string
          raca?: string | null
          sexo: Database["public"]["Enums"]["sexo_animal"]
          situacao?: Database["public"]["Enums"]["situacao_animal"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          data_nascimento?: string | null
          id?: string
          lote_id?: string | null
          mae_id?: string | null
          nome?: string | null
          numero_brinco?: string
          observacoes?: string | null
          pai_id?: string | null
          propriedade_id?: string
          raca?: string | null
          sexo?: Database["public"]["Enums"]["sexo_animal"]
          situacao?: Database["public"]["Enums"]["situacao_animal"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "animais_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: false
            referencedRelation: "lotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "animais_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: false
            referencedRelation: "v_animais_por_lote"
            referencedColumns: ["lote_id"]
          },
          {
            foreignKeyName: "animais_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: false
            referencedRelation: "v_producao_por_lote"
            referencedColumns: ["lote_id"]
          },
          {
            foreignKeyName: "animais_mae_id_fkey"
            columns: ["mae_id"]
            isOneToOne: false
            referencedRelation: "animais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "animais_pai_id_fkey"
            columns: ["pai_id"]
            isOneToOne: false
            referencedRelation: "animais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "animais_propriedade_id_fkey"
            columns: ["propriedade_id"]
            isOneToOne: false
            referencedRelation: "propriedades"
            referencedColumns: ["id"]
          },
        ]
      }
      anotacoes_producao: {
        Row: {
          alimentacao: string | null
          animal_id: string | null
          comportamento: string | null
          created_at: string
          data: string
          id: string
          informacoes_adicionais: string | null
          lote_id: string | null
          observacao: string
          producao: number | null
          propriedade_id: string
          updated_at: string
        }
        Insert: {
          alimentacao?: string | null
          animal_id?: string | null
          comportamento?: string | null
          created_at?: string
          data?: string
          id?: string
          informacoes_adicionais?: string | null
          lote_id?: string | null
          observacao: string
          producao?: number | null
          propriedade_id: string
          updated_at?: string
        }
        Update: {
          alimentacao?: string | null
          animal_id?: string | null
          comportamento?: string | null
          created_at?: string
          data?: string
          id?: string
          informacoes_adicionais?: string | null
          lote_id?: string | null
          observacao?: string
          producao?: number | null
          propriedade_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "anotacoes_producao_animal_id_fkey"
            columns: ["animal_id"]
            isOneToOne: false
            referencedRelation: "animais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anotacoes_producao_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: false
            referencedRelation: "lotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anotacoes_producao_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: false
            referencedRelation: "v_animais_por_lote"
            referencedColumns: ["lote_id"]
          },
          {
            foreignKeyName: "anotacoes_producao_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: false
            referencedRelation: "v_producao_por_lote"
            referencedColumns: ["lote_id"]
          },
          {
            foreignKeyName: "anotacoes_producao_propriedade_id_fkey"
            columns: ["propriedade_id"]
            isOneToOne: false
            referencedRelation: "propriedades"
            referencedColumns: ["id"]
          },
        ]
      }
      assinaturas: {
        Row: {
          created_at: string
          data_expiracao: string | null
          data_inicio: string | null
          id: string
          origem: string
          plano: Database["public"]["Enums"]["tipo_plano"]
          propriedade_id: string
          status: Database["public"]["Enums"]["status_assinatura"]
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          data_expiracao?: string | null
          data_inicio?: string | null
          id?: string
          origem?: string
          plano?: Database["public"]["Enums"]["tipo_plano"]
          propriedade_id: string
          status?: Database["public"]["Enums"]["status_assinatura"]
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          data_expiracao?: string | null
          data_inicio?: string | null
          id?: string
          origem?: string
          plano?: Database["public"]["Enums"]["tipo_plano"]
          propriedade_id?: string
          status?: Database["public"]["Enums"]["status_assinatura"]
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assinaturas_propriedade_id_fkey"
            columns: ["propriedade_id"]
            isOneToOne: false
            referencedRelation: "propriedades"
            referencedColumns: ["id"]
          },
        ]
      }
      compras: {
        Row: {
          categoria: string
          created_at: string
          data: string
          fornecedor: string | null
          id: string
          movimentacao_id: string | null
          observacao: string | null
          produto_animal: string
          propriedade_id: string
          quantidade: number
          updated_at: string
          valor: number
        }
        Insert: {
          categoria: string
          created_at?: string
          data: string
          fornecedor?: string | null
          id?: string
          movimentacao_id?: string | null
          observacao?: string | null
          produto_animal: string
          propriedade_id: string
          quantidade: number
          updated_at?: string
          valor: number
        }
        Update: {
          categoria?: string
          created_at?: string
          data?: string
          fornecedor?: string | null
          id?: string
          movimentacao_id?: string | null
          observacao?: string | null
          produto_animal?: string
          propriedade_id?: string
          quantidade?: number
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "compras_movimentacao_id_fkey"
            columns: ["movimentacao_id"]
            isOneToOne: true
            referencedRelation: "movimentacoes_financeiras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compras_propriedade_id_fkey"
            columns: ["propriedade_id"]
            isOneToOne: false
            referencedRelation: "propriedades"
            referencedColumns: ["id"]
          },
        ]
      }
      configuracoes: {
        Row: {
          chave: string
          created_at: string
          id: string
          propriedade_id: string
          updated_at: string
          valor: Json
        }
        Insert: {
          chave: string
          created_at?: string
          id?: string
          propriedade_id: string
          updated_at?: string
          valor?: Json
        }
        Update: {
          chave?: string
          created_at?: string
          id?: string
          propriedade_id?: string
          updated_at?: string
          valor?: Json
        }
        Relationships: [
          {
            foreignKeyName: "configuracoes_propriedade_id_fkey"
            columns: ["propriedade_id"]
            isOneToOne: false
            referencedRelation: "propriedades"
            referencedColumns: ["id"]
          },
        ]
      }
      importacoes: {
        Row: {
          aceitas: number
          arquivo: string
          atualizado_em: string
          criado_em: string
          erro: string | null
          id: string
          processadas: number
          propriedade_id: string
          rejeitadas: number
          rejeitadas_detalhe: Json
          status: string
          tabela: string
          total_linhas: number
        }
        Insert: {
          aceitas?: number
          arquivo: string
          atualizado_em?: string
          criado_em?: string
          erro?: string | null
          id?: string
          processadas?: number
          propriedade_id: string
          rejeitadas?: number
          rejeitadas_detalhe?: Json
          status?: string
          tabela: string
          total_linhas?: number
        }
        Update: {
          aceitas?: number
          arquivo?: string
          atualizado_em?: string
          criado_em?: string
          erro?: string | null
          id?: string
          processadas?: number
          propriedade_id?: string
          rejeitadas?: number
          rejeitadas_detalhe?: Json
          status?: string
          tabela?: string
          total_linhas?: number
        }
        Relationships: [
          {
            foreignKeyName: "importacoes_propriedade_id_fkey"
            columns: ["propriedade_id"]
            isOneToOne: false
            referencedRelation: "propriedades"
            referencedColumns: ["id"]
          },
        ]
      }
      inseminacoes: {
        Row: {
          animal_id: string
          created_at: string
          data_inseminacao: string
          id: string
          observacao: string | null
          previsao_parto: string
          propriedade_id: string
          reprodutor_semen: string
          situacao: Database["public"]["Enums"]["status_inseminacao"]
          updated_at: string
        }
        Insert: {
          animal_id: string
          created_at?: string
          data_inseminacao: string
          id?: string
          observacao?: string | null
          previsao_parto: string
          propriedade_id: string
          reprodutor_semen: string
          situacao?: Database["public"]["Enums"]["status_inseminacao"]
          updated_at?: string
        }
        Update: {
          animal_id?: string
          created_at?: string
          data_inseminacao?: string
          id?: string
          observacao?: string | null
          previsao_parto?: string
          propriedade_id?: string
          reprodutor_semen?: string
          situacao?: Database["public"]["Enums"]["status_inseminacao"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inseminacoes_animal_id_fkey"
            columns: ["animal_id"]
            isOneToOne: false
            referencedRelation: "animais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inseminacoes_propriedade_id_fkey"
            columns: ["propriedade_id"]
            isOneToOne: false
            referencedRelation: "propriedades"
            referencedColumns: ["id"]
          },
        ]
      }
      investimentos: {
        Row: {
          categoria: string
          created_at: string
          data: string
          descricao: string
          id: string
          movimentacao_id: string | null
          observacao: string | null
          propriedade_id: string
          updated_at: string
          valor: number
        }
        Insert: {
          categoria: string
          created_at?: string
          data: string
          descricao: string
          id?: string
          movimentacao_id?: string | null
          observacao?: string | null
          propriedade_id: string
          updated_at?: string
          valor: number
        }
        Update: {
          categoria?: string
          created_at?: string
          data?: string
          descricao?: string
          id?: string
          movimentacao_id?: string | null
          observacao?: string | null
          propriedade_id?: string
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "investimentos_movimentacao_id_fkey"
            columns: ["movimentacao_id"]
            isOneToOne: true
            referencedRelation: "movimentacoes_financeiras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investimentos_propriedade_id_fkey"
            columns: ["propriedade_id"]
            isOneToOne: false
            referencedRelation: "propriedades"
            referencedColumns: ["id"]
          },
        ]
      }
      lotes: {
        Row: {
          ativo: boolean
          created_at: string
          descricao: string | null
          finalidade: string | null
          id: string
          nome: string
          propriedade_id: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          finalidade?: string | null
          id?: string
          nome: string
          propriedade_id: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          finalidade?: string | null
          id?: string
          nome?: string
          propriedade_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lotes_propriedade_id_fkey"
            columns: ["propriedade_id"]
            isOneToOne: false
            referencedRelation: "propriedades"
            referencedColumns: ["id"]
          },
        ]
      }
      movimentacoes_financeiras: {
        Row: {
          categoria: string
          created_at: string
          data: string
          descricao: string
          id: string
          observacao: string | null
          origem_id: string | null
          origem_tipo: Database["public"]["Enums"]["tipo_operacao"] | null
          propriedade_id: string
          tipo: Database["public"]["Enums"]["tipo_movimento"]
          updated_at: string
          valor: number
        }
        Insert: {
          categoria: string
          created_at?: string
          data: string
          descricao: string
          id?: string
          observacao?: string | null
          origem_id?: string | null
          origem_tipo?: Database["public"]["Enums"]["tipo_operacao"] | null
          propriedade_id: string
          tipo: Database["public"]["Enums"]["tipo_movimento"]
          updated_at?: string
          valor: number
        }
        Update: {
          categoria?: string
          created_at?: string
          data?: string
          descricao?: string
          id?: string
          observacao?: string | null
          origem_id?: string | null
          origem_tipo?: Database["public"]["Enums"]["tipo_operacao"] | null
          propriedade_id?: string
          tipo?: Database["public"]["Enums"]["tipo_movimento"]
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "movimentacoes_financeiras_propriedade_id_fkey"
            columns: ["propriedade_id"]
            isOneToOne: false
            referencedRelation: "propriedades"
            referencedColumns: ["id"]
          },
        ]
      }
      nascimentos: {
        Row: {
          bezerro_id: string
          created_at: string
          data_nascimento: string
          id: string
          lote_id: string | null
          observacoes: string | null
          propriedade_id: string
          sexo: Database["public"]["Enums"]["sexo_animal"]
          updated_at: string
          vaca_id: string
        }
        Insert: {
          bezerro_id: string
          created_at?: string
          data_nascimento: string
          id?: string
          lote_id?: string | null
          observacoes?: string | null
          propriedade_id: string
          sexo: Database["public"]["Enums"]["sexo_animal"]
          updated_at?: string
          vaca_id: string
        }
        Update: {
          bezerro_id?: string
          created_at?: string
          data_nascimento?: string
          id?: string
          lote_id?: string | null
          observacoes?: string | null
          propriedade_id?: string
          sexo?: Database["public"]["Enums"]["sexo_animal"]
          updated_at?: string
          vaca_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "nascimentos_bezerro_id_fkey"
            columns: ["bezerro_id"]
            isOneToOne: true
            referencedRelation: "animais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nascimentos_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: false
            referencedRelation: "lotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nascimentos_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: false
            referencedRelation: "v_animais_por_lote"
            referencedColumns: ["lote_id"]
          },
          {
            foreignKeyName: "nascimentos_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: false
            referencedRelation: "v_producao_por_lote"
            referencedColumns: ["lote_id"]
          },
          {
            foreignKeyName: "nascimentos_propriedade_id_fkey"
            columns: ["propriedade_id"]
            isOneToOne: false
            referencedRelation: "propriedades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nascimentos_vaca_id_fkey"
            columns: ["vaca_id"]
            isOneToOne: false
            referencedRelation: "animais"
            referencedColumns: ["id"]
          },
        ]
      }
      notificacoes: {
        Row: {
          created_at: string
          id: string
          lida: boolean
          mensagem: string
          propriedade_id: string | null
          titulo: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          lida?: boolean
          mensagem: string
          propriedade_id?: string | null
          titulo: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          lida?: boolean
          mensagem?: string
          propriedade_id?: string | null
          titulo?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notificacoes_propriedade_id_fkey"
            columns: ["propriedade_id"]
            isOneToOne: false
            referencedRelation: "propriedades"
            referencedColumns: ["id"]
          },
        ]
      }
      pesagens: {
        Row: {
          animal_id: string
          created_at: string
          data: string
          id: string
          observacoes: string | null
          peso_kg: number
          propriedade_id: string
          updated_at: string
        }
        Insert: {
          animal_id: string
          created_at?: string
          data: string
          id?: string
          observacoes?: string | null
          peso_kg: number
          propriedade_id: string
          updated_at?: string
        }
        Update: {
          animal_id?: string
          created_at?: string
          data?: string
          id?: string
          observacoes?: string | null
          peso_kg?: number
          propriedade_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pesagens_animal_id_fkey"
            columns: ["animal_id"]
            isOneToOne: false
            referencedRelation: "animais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pesagens_propriedade_id_fkey"
            columns: ["propriedade_id"]
            isOneToOne: false
            referencedRelation: "propriedades"
            referencedColumns: ["id"]
          },
        ]
      }
      plano_auditoria: {
        Row: {
          alterado_por: string
          assinatura_id: string | null
          created_at: string
          id: string
          motivo: string | null
          origem: string
          plano_anterior: Database["public"]["Enums"]["tipo_plano"] | null
          plano_novo: Database["public"]["Enums"]["tipo_plano"] | null
          propriedade_id: string | null
          status_anterior:
            | Database["public"]["Enums"]["status_assinatura"]
            | null
          status_novo: Database["public"]["Enums"]["status_assinatura"] | null
          user_id: string
        }
        Insert: {
          alterado_por: string
          assinatura_id?: string | null
          created_at?: string
          id?: string
          motivo?: string | null
          origem?: string
          plano_anterior?: Database["public"]["Enums"]["tipo_plano"] | null
          plano_novo?: Database["public"]["Enums"]["tipo_plano"] | null
          propriedade_id?: string | null
          status_anterior?:
            | Database["public"]["Enums"]["status_assinatura"]
            | null
          status_novo?: Database["public"]["Enums"]["status_assinatura"] | null
          user_id: string
        }
        Update: {
          alterado_por?: string
          assinatura_id?: string | null
          created_at?: string
          id?: string
          motivo?: string | null
          origem?: string
          plano_anterior?: Database["public"]["Enums"]["tipo_plano"] | null
          plano_novo?: Database["public"]["Enums"]["tipo_plano"] | null
          propriedade_id?: string | null
          status_anterior?:
            | Database["public"]["Enums"]["status_assinatura"]
            | null
          status_novo?: Database["public"]["Enums"]["status_assinatura"] | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plano_auditoria_assinatura_id_fkey"
            columns: ["assinatura_id"]
            isOneToOne: false
            referencedRelation: "assinaturas"
            referencedColumns: ["id"]
          },
        ]
      }
      producao_leite: {
        Row: {
          animal_id: string
          created_at: string
          data: string
          id: string
          litros: number
          lote_id: string | null
          observacao: string | null
          propriedade_id: string
          updated_at: string
          valor_litro: number
          valor_total: number | null
        }
        Insert: {
          animal_id: string
          created_at?: string
          data: string
          id?: string
          litros: number
          lote_id?: string | null
          observacao?: string | null
          propriedade_id: string
          updated_at?: string
          valor_litro?: number
          valor_total?: number | null
        }
        Update: {
          animal_id?: string
          created_at?: string
          data?: string
          id?: string
          litros?: number
          lote_id?: string | null
          observacao?: string | null
          propriedade_id?: string
          updated_at?: string
          valor_litro?: number
          valor_total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "producao_leite_animal_id_fkey"
            columns: ["animal_id"]
            isOneToOne: false
            referencedRelation: "animais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "producao_leite_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: false
            referencedRelation: "lotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "producao_leite_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: false
            referencedRelation: "v_animais_por_lote"
            referencedColumns: ["lote_id"]
          },
          {
            foreignKeyName: "producao_leite_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: false
            referencedRelation: "v_producao_por_lote"
            referencedColumns: ["lote_id"]
          },
          {
            foreignKeyName: "producao_leite_propriedade_id_fkey"
            columns: ["propriedade_id"]
            isOneToOne: false
            referencedRelation: "propriedades"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          biografia: string | null
          bloqueado: boolean
          cargo: string | null
          created_at: string
          id: string
          nome_completo: string
          nome_exibicao: string | null
          preferencias: Json
          telefone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          biografia?: string | null
          bloqueado?: boolean
          cargo?: string | null
          created_at?: string
          id: string
          nome_completo?: string
          nome_exibicao?: string | null
          preferencias?: Json
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          biografia?: string | null
          bloqueado?: boolean
          cargo?: string | null
          created_at?: string
          id?: string
          nome_completo?: string
          nome_exibicao?: string | null
          preferencias?: Json
          telefone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      propriedade_membros: {
        Row: {
          created_at: string
          id: string
          propriedade_id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          propriedade_id: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          propriedade_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "propriedade_membros_propriedade_id_fkey"
            columns: ["propriedade_id"]
            isOneToOne: false
            referencedRelation: "propriedades"
            referencedColumns: ["id"]
          },
        ]
      }
      propriedade_perfil: {
        Row: {
          banner_url: string | null
          created_at: string
          descricao: string | null
          email: string | null
          endereco: string | null
          id: string
          imagem_url: string | null
          logo_url: string | null
          propriedade_id: string
          telefone: string | null
          texto_apresentacao: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          banner_url?: string | null
          created_at?: string
          descricao?: string | null
          email?: string | null
          endereco?: string | null
          id?: string
          imagem_url?: string | null
          logo_url?: string | null
          propriedade_id: string
          telefone?: string | null
          texto_apresentacao?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          banner_url?: string | null
          created_at?: string
          descricao?: string | null
          email?: string | null
          endereco?: string | null
          id?: string
          imagem_url?: string | null
          logo_url?: string | null
          propriedade_id?: string
          telefone?: string | null
          texto_apresentacao?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "propriedade_perfil_propriedade_id_fkey"
            columns: ["propriedade_id"]
            isOneToOne: true
            referencedRelation: "propriedades"
            referencedColumns: ["id"]
          },
        ]
      }
      propriedades: {
        Row: {
          ativo: boolean
          cidade: string | null
          created_at: string
          estado: string | null
          id: string
          nome: string
          periodo_gestacao_dias: number
          proprietario_id: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          cidade?: string | null
          created_at?: string
          estado?: string | null
          id?: string
          nome: string
          periodo_gestacao_dias?: number
          proprietario_id: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          cidade?: string | null
          created_at?: string
          estado?: string | null
          id?: string
          nome?: string
          periodo_gestacao_dias?: number
          proprietario_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          chave: string
          contador: number
          janela: string
        }
        Insert: {
          chave: string
          contador?: number
          janela: string
        }
        Update: {
          chave?: string
          contador?: number
          janela?: string
        }
        Relationships: []
      }
      tipos_vacinas: {
        Row: {
          ativo: boolean
          created_at: string
          descricao: string | null
          id: string
          intervalo_dias: number | null
          nome: string
          propriedade_id: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          intervalo_dias?: number | null
          nome: string
          propriedade_id: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          intervalo_dias?: number | null
          nome?: string
          propriedade_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tipos_vacinas_propriedade_id_fkey"
            columns: ["propriedade_id"]
            isOneToOne: false
            referencedRelation: "propriedades"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vacinacoes: {
        Row: {
          animal_id: string | null
          created_at: string
          data_aplicacao: string
          id: string
          lote_id: string | null
          observacao: string | null
          propriedade_id: string
          proxima_aplicacao: string | null
          responsavel: string | null
          tipo_vacina_id: string
          updated_at: string
        }
        Insert: {
          animal_id?: string | null
          created_at?: string
          data_aplicacao: string
          id?: string
          lote_id?: string | null
          observacao?: string | null
          propriedade_id: string
          proxima_aplicacao?: string | null
          responsavel?: string | null
          tipo_vacina_id: string
          updated_at?: string
        }
        Update: {
          animal_id?: string | null
          created_at?: string
          data_aplicacao?: string
          id?: string
          lote_id?: string | null
          observacao?: string | null
          propriedade_id?: string
          proxima_aplicacao?: string | null
          responsavel?: string | null
          tipo_vacina_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vacinacoes_animal_id_fkey"
            columns: ["animal_id"]
            isOneToOne: false
            referencedRelation: "animais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vacinacoes_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: false
            referencedRelation: "lotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vacinacoes_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: false
            referencedRelation: "v_animais_por_lote"
            referencedColumns: ["lote_id"]
          },
          {
            foreignKeyName: "vacinacoes_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: false
            referencedRelation: "v_producao_por_lote"
            referencedColumns: ["lote_id"]
          },
          {
            foreignKeyName: "vacinacoes_propriedade_id_fkey"
            columns: ["propriedade_id"]
            isOneToOne: false
            referencedRelation: "propriedades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vacinacoes_tipo_vacina_id_fkey"
            columns: ["tipo_vacina_id"]
            isOneToOne: false
            referencedRelation: "tipos_vacinas"
            referencedColumns: ["id"]
          },
        ]
      }
      vendas: {
        Row: {
          animal_id: string | null
          categoria: string
          comprador: string | null
          created_at: string
          data: string
          id: string
          item: string
          movimentacao_id: string | null
          observacao: string | null
          propriedade_id: string
          quantidade: number
          updated_at: string
          valor: number
        }
        Insert: {
          animal_id?: string | null
          categoria: string
          comprador?: string | null
          created_at?: string
          data: string
          id?: string
          item: string
          movimentacao_id?: string | null
          observacao?: string | null
          propriedade_id: string
          quantidade: number
          updated_at?: string
          valor: number
        }
        Update: {
          animal_id?: string | null
          categoria?: string
          comprador?: string | null
          created_at?: string
          data?: string
          id?: string
          item?: string
          movimentacao_id?: string | null
          observacao?: string | null
          propriedade_id?: string
          quantidade?: number
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "vendas_animal_id_fkey"
            columns: ["animal_id"]
            isOneToOne: false
            referencedRelation: "animais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendas_movimentacao_id_fkey"
            columns: ["movimentacao_id"]
            isOneToOne: true
            referencedRelation: "movimentacoes_financeiras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendas_propriedade_id_fkey"
            columns: ["propriedade_id"]
            isOneToOne: false
            referencedRelation: "propriedades"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_animais_por_lote: {
        Row: {
          lote_id: string | null
          nome: string | null
          propriedade_id: string | null
          quantidade: number | null
        }
        Relationships: [
          {
            foreignKeyName: "lotes_propriedade_id_fkey"
            columns: ["propriedade_id"]
            isOneToOne: false
            referencedRelation: "propriedades"
            referencedColumns: ["id"]
          },
        ]
      }
      v_financeiro_mensal: {
        Row: {
          despesas: number | null
          investimentos: number | null
          lucro: number | null
          mes: string | null
          propriedade_id: string | null
          receitas: number | null
        }
        Relationships: [
          {
            foreignKeyName: "movimentacoes_financeiras_propriedade_id_fkey"
            columns: ["propriedade_id"]
            isOneToOne: false
            referencedRelation: "propriedades"
            referencedColumns: ["id"]
          },
        ]
      }
      v_financeiro_por_categoria: {
        Row: {
          categoria: string | null
          mes: string | null
          propriedade_id: string | null
          tipo: Database["public"]["Enums"]["tipo_movimento"] | null
          total: number | null
        }
        Relationships: [
          {
            foreignKeyName: "movimentacoes_financeiras_propriedade_id_fkey"
            columns: ["propriedade_id"]
            isOneToOne: false
            referencedRelation: "propriedades"
            referencedColumns: ["id"]
          },
        ]
      }
      v_producao_mensal: {
        Row: {
          media_registro: number | null
          mes: string | null
          propriedade_id: string | null
          total_litros: number | null
          valor_total: number | null
        }
        Relationships: [
          {
            foreignKeyName: "producao_leite_propriedade_id_fkey"
            columns: ["propriedade_id"]
            isOneToOne: false
            referencedRelation: "propriedades"
            referencedColumns: ["id"]
          },
        ]
      }
      v_producao_por_lote: {
        Row: {
          lote_id: string | null
          lote_nome: string | null
          mes: string | null
          propriedade_id: string | null
          total_litros: number | null
          vacas: number | null
          valor_total: number | null
        }
        Relationships: [
          {
            foreignKeyName: "producao_leite_propriedade_id_fkey"
            columns: ["propriedade_id"]
            isOneToOne: false
            referencedRelation: "propriedades"
            referencedColumns: ["id"]
          },
        ]
      }
      v_vacinacoes_status: {
        Row: {
          animal_id: string | null
          created_at: string | null
          data_aplicacao: string | null
          dias_restantes: number | null
          id: string | null
          lote_id: string | null
          observacao: string | null
          propriedade_id: string | null
          proxima_aplicacao: string | null
          responsavel: string | null
          status_calculado: string | null
          tipo_vacina_id: string | null
          updated_at: string | null
        }
        Insert: {
          animal_id?: string | null
          created_at?: string | null
          data_aplicacao?: string | null
          dias_restantes?: never
          id?: string | null
          lote_id?: string | null
          observacao?: string | null
          propriedade_id?: string | null
          proxima_aplicacao?: string | null
          responsavel?: string | null
          status_calculado?: never
          tipo_vacina_id?: string | null
          updated_at?: string | null
        }
        Update: {
          animal_id?: string | null
          created_at?: string | null
          data_aplicacao?: string | null
          dias_restantes?: never
          id?: string | null
          lote_id?: string | null
          observacao?: string | null
          propriedade_id?: string | null
          proxima_aplicacao?: string | null
          responsavel?: string | null
          status_calculado?: never
          tipo_vacina_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vacinacoes_animal_id_fkey"
            columns: ["animal_id"]
            isOneToOne: false
            referencedRelation: "animais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vacinacoes_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: false
            referencedRelation: "lotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vacinacoes_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: false
            referencedRelation: "v_animais_por_lote"
            referencedColumns: ["lote_id"]
          },
          {
            foreignKeyName: "vacinacoes_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: false
            referencedRelation: "v_producao_por_lote"
            referencedColumns: ["lote_id"]
          },
          {
            foreignKeyName: "vacinacoes_propriedade_id_fkey"
            columns: ["propriedade_id"]
            isOneToOne: false
            referencedRelation: "propriedades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vacinacoes_tipo_vacina_id_fkey"
            columns: ["tipo_vacina_id"]
            isOneToOne: false
            referencedRelation: "tipos_vacinas"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      admin_contas: {
        Args: never
        Returns: {
          admin: boolean
          bloqueado: boolean
          bytes_estimados: number
          criado_em: string
          email: string
          nome: string
          propriedades: number
          registros: number
          ultimo_acesso: string
          user_id: string
        }[]
      }
      admin_definir_conta: {
        Args: { _admin?: boolean; _bloqueado?: boolean; _user_id: string }
        Returns: undefined
      }
      admin_sistema: { Args: never; Returns: Json }
      cancelar_plano_demonstracao: {
        Args: { _motivo?: string; _propriedade_id: string }
        Returns: Json
      }
      checar_limite: {
        Args: { _chave: string; _max: number; _segundos: number }
        Returns: boolean
      }
      dashboard_resumo: { Args: { _propriedade_id: string }; Returns: Json }
      diagnostico_propriedade: {
        Args: { _propriedade_id: string }
        Returns: Json
      }
      minha_assinatura: { Args: { _propriedade_id: string }; Returns: Json }
      pode_gerenciar_planos: { Args: never; Returns: boolean }
      registros_inconsistentes: {
        Args: { _propriedade_id: string }
        Returns: Json
      }
      relatorio_indicadores: {
        Args: { _ate?: string; _de?: string; _propriedade_id: string }
        Returns: Json
      }
      setar_plano_demonstracao: {
        Args: {
          _data_expiracao?: string
          _motivo?: string
          _plano?: Database["public"]["Enums"]["tipo_plano"]
          _propriedade_id: string
          _status?: Database["public"]["Enums"]["status_assinatura"]
        }
        Returns: Json
      }
      sou_admin: { Args: never; Returns: boolean }
    }
    Enums: {
      app_role:
        | "proprietario"
        | "administrador"
        | "colaborador"
        | "visualizador"
      sexo_animal: "M" | "F"
      situacao_animal:
        | "ativo"
        | "vendido"
        | "perdido"
        | "falecido"
        | "transferido"
      status_assinatura:
        | "ativo"
        | "trial"
        | "cancelado"
        | "expirado"
        | "pendente"
      status_inseminacao:
        | "em_andamento"
        | "confirmada"
        | "falhou"
        | "parto_realizado"
        | "cancelada"
      tipo_movimento: "receita" | "despesa" | "investimento"
      tipo_operacao: "compra" | "venda"
      tipo_plano: "gratuito" | "premium"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "proprietario",
        "administrador",
        "colaborador",
        "visualizador",
      ],
      sexo_animal: ["M", "F"],
      situacao_animal: [
        "ativo",
        "vendido",
        "perdido",
        "falecido",
        "transferido",
      ],
      status_assinatura: [
        "ativo",
        "trial",
        "cancelado",
        "expirado",
        "pendente",
      ],
      status_inseminacao: [
        "em_andamento",
        "confirmada",
        "falhou",
        "parto_realizado",
        "cancelada",
      ],
      tipo_movimento: ["receita", "despesa", "investimento"],
      tipo_operacao: ["compra", "venda"],
      tipo_plano: ["gratuito", "premium"],
    },
  },
} as const
