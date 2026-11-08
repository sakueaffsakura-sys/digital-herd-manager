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
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      alimentacao: {
        Row: {
          animal_id: string | null
          cocho: string | null
          created_at: string
          data: string
          id: string
          item_id: string
          lote_id: string | null
          mudanca: boolean | null
          obs: string | null
          propriedade_id: string
          qtd: number
          updated_at: string
        }
        Insert: {
          animal_id?: string | null
          cocho?: string | null
          created_at?: string
          data?: string
          id?: string
          item_id: string
          lote_id?: string | null
          mudanca?: boolean | null
          obs?: string | null
          propriedade_id: string
          qtd: number
          updated_at?: string
        }
        Update: {
          animal_id?: string | null
          cocho?: string | null
          created_at?: string
          data?: string
          id?: string
          item_id?: string
          lote_id?: string | null
          mudanca?: boolean | null
          obs?: string | null
          propriedade_id?: string
          qtd?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "alimentacao_animal_id_fkey"
            columns: ["animal_id"]
            isOneToOne: false
            referencedRelation: "animais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alimentacao_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "estoque_itens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alimentacao_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: false
            referencedRelation: "lotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alimentacao_propriedade_id_fkey"
            columns: ["propriedade_id"]
            isOneToOne: false
            referencedRelation: "propriedades"
            referencedColumns: ["id"]
          },
        ]
      }
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
      animal_extra: {
        Row: {
          animal_id: string
          created_at: string
          finalidade: string | null
          id: string
          identificacao: string | null
          obs: string | null
          origem: string | null
          pasto_id: string | null
          pelagem: string | null
          procedencia: string | null
          propriedade_id: string
          updated_at: string
        }
        Insert: {
          animal_id: string
          created_at?: string
          finalidade?: string | null
          id?: string
          identificacao?: string | null
          obs?: string | null
          origem?: string | null
          pasto_id?: string | null
          pelagem?: string | null
          procedencia?: string | null
          propriedade_id: string
          updated_at?: string
        }
        Update: {
          animal_id?: string
          created_at?: string
          finalidade?: string | null
          id?: string
          identificacao?: string | null
          obs?: string | null
          origem?: string | null
          pasto_id?: string | null
          pelagem?: string | null
          procedencia?: string | null
          propriedade_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "animal_extra_animal_id_fkey"
            columns: ["animal_id"]
            isOneToOne: false
            referencedRelation: "animais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "animal_extra_pasto_id_fkey"
            columns: ["pasto_id"]
            isOneToOne: false
            referencedRelation: "pastos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "animal_extra_propriedade_id_fkey"
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
          marcada: boolean
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
          marcada?: boolean
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
          marcada?: boolean
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
      atividades_agro: {
        Row: {
          colhido_kg: number | null
          created_at: string
          custo: number | null
          data: string
          descricao: string | null
          entrada_item_id: string | null
          id: string
          item_id: string | null
          obs: string | null
          perda_kg: number | null
          plantio_id: string
          praga: string | null
          propriedade_id: string
          qtd: number | null
          tipo: string
          updated_at: string
        }
        Insert: {
          colhido_kg?: number | null
          created_at?: string
          custo?: number | null
          data?: string
          descricao?: string | null
          entrada_item_id?: string | null
          id?: string
          item_id?: string | null
          obs?: string | null
          perda_kg?: number | null
          plantio_id: string
          praga?: string | null
          propriedade_id: string
          qtd?: number | null
          tipo?: string
          updated_at?: string
        }
        Update: {
          colhido_kg?: number | null
          created_at?: string
          custo?: number | null
          data?: string
          descricao?: string | null
          entrada_item_id?: string | null
          id?: string
          item_id?: string | null
          obs?: string | null
          perda_kg?: number | null
          plantio_id?: string
          praga?: string | null
          propriedade_id?: string
          qtd?: number | null
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "atividades_agro_entrada_item_id_fkey"
            columns: ["entrada_item_id"]
            isOneToOne: false
            referencedRelation: "estoque_itens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atividades_agro_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "estoque_itens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atividades_agro_plantio_id_fkey"
            columns: ["plantio_id"]
            isOneToOne: false
            referencedRelation: "plantios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atividades_agro_propriedade_id_fkey"
            columns: ["propriedade_id"]
            isOneToOne: false
            referencedRelation: "propriedades"
            referencedColumns: ["id"]
          },
        ]
      }
      avaliacoes: {
        Row: {
          animal_id: string | null
          created_at: string
          data: string
          id: string
          lote_id: string | null
          obs: string | null
          pasto_id: string | null
          propriedade_id: string
          responsavel: string | null
          tipo: string
          updated_at: string
          valor: number
        }
        Insert: {
          animal_id?: string | null
          created_at?: string
          data?: string
          id?: string
          lote_id?: string | null
          obs?: string | null
          pasto_id?: string | null
          propriedade_id: string
          responsavel?: string | null
          tipo?: string
          updated_at?: string
          valor: number
        }
        Update: {
          animal_id?: string | null
          created_at?: string
          data?: string
          id?: string
          lote_id?: string | null
          obs?: string | null
          pasto_id?: string | null
          propriedade_id?: string
          responsavel?: string | null
          tipo?: string
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "avaliacoes_animal_id_fkey"
            columns: ["animal_id"]
            isOneToOne: false
            referencedRelation: "animais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avaliacoes_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: false
            referencedRelation: "lotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avaliacoes_pasto_id_fkey"
            columns: ["pasto_id"]
            isOneToOne: false
            referencedRelation: "pastos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avaliacoes_propriedade_id_fkey"
            columns: ["propriedade_id"]
            isOneToOne: false
            referencedRelation: "propriedades"
            referencedColumns: ["id"]
          },
        ]
      }
      bezerros_info: {
        Row: {
          animal_id: string
          colostro: string
          created_at: string
          desmamado_em: string | null
          desmame_previsto: string | null
          id: string
          obs: string | null
          orfao: boolean | null
          parto: string | null
          peso_nascer: number | null
          propriedade_id: string
          updated_at: string
        }
        Insert: {
          animal_id: string
          colostro?: string
          created_at?: string
          desmamado_em?: string | null
          desmame_previsto?: string | null
          id?: string
          obs?: string | null
          orfao?: boolean | null
          parto?: string | null
          peso_nascer?: number | null
          propriedade_id: string
          updated_at?: string
        }
        Update: {
          animal_id?: string
          colostro?: string
          created_at?: string
          desmamado_em?: string | null
          desmame_previsto?: string | null
          id?: string
          obs?: string | null
          orfao?: boolean | null
          parto?: string | null
          peso_nascer?: number | null
          propriedade_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bezerros_info_animal_id_fkey"
            columns: ["animal_id"]
            isOneToOne: false
            referencedRelation: "animais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bezerros_info_propriedade_id_fkey"
            columns: ["propriedade_id"]
            isOneToOne: false
            referencedRelation: "propriedades"
            referencedColumns: ["id"]
          },
        ]
      }
      bloqueios_acesso: {
        Row: {
          ativo: boolean
          criado_em: string
          expira_em: string | null
          id: string
          incidente_id: string | null
          motivo: string
          removido_em: string | null
          removido_por: string | null
          tentativas: number
          tipo: string
          ultima_tentativa: string | null
          valor: string
        }
        Insert: {
          ativo?: boolean
          criado_em?: string
          expira_em?: string | null
          id?: string
          incidente_id?: string | null
          motivo: string
          removido_em?: string | null
          removido_por?: string | null
          tentativas?: number
          tipo: string
          ultima_tentativa?: string | null
          valor: string
        }
        Update: {
          ativo?: boolean
          criado_em?: string
          expira_em?: string | null
          id?: string
          incidente_id?: string | null
          motivo?: string
          removido_em?: string | null
          removido_por?: string | null
          tentativas?: number
          tipo?: string
          ultima_tentativa?: string | null
          valor?: string
        }
        Relationships: [
          {
            foreignKeyName: "bloqueios_acesso_incidente_id_fkey"
            columns: ["incidente_id"]
            isOneToOne: false
            referencedRelation: "incidentes_seguranca"
            referencedColumns: ["id"]
          },
        ]
      }
      campanhas: {
        Row: {
          created_at: string
          fim: string | null
          id: string
          inicio: string
          lotes: string | null
          nome: string
          obs: string | null
          produto: string | null
          propriedade_id: string
          status: string
          tipo: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          fim?: string | null
          id?: string
          inicio?: string
          lotes?: string | null
          nome: string
          obs?: string | null
          produto?: string | null
          propriedade_id: string
          status?: string
          tipo?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          fim?: string | null
          id?: string
          inicio?: string
          lotes?: string | null
          nome?: string
          obs?: string | null
          produto?: string | null
          propriedade_id?: string
          status?: string
          tipo?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campanhas_propriedade_id_fkey"
            columns: ["propriedade_id"]
            isOneToOne: false
            referencedRelation: "propriedades"
            referencedColumns: ["id"]
          },
        ]
      }
      chaves_sistema: {
        Row: {
          alterado_em: string
          alterado_por: string | null
          final: string
          nome: string
          valor_cifrado: string
        }
        Insert: {
          alterado_em?: string
          alterado_por?: string | null
          final: string
          nome: string
          valor_cifrado: string
        }
        Update: {
          alterado_em?: string
          alterado_por?: string | null
          final?: string
          nome?: string
          valor_cifrado?: string
        }
        Relationships: []
      }
      cios: {
        Row: {
          acao: string | null
          animal_id: string
          created_at: string
          data: string
          id: string
          obs: string | null
          propriedade_id: string
          sinais: string | null
          updated_at: string
        }
        Insert: {
          acao?: string | null
          animal_id: string
          created_at?: string
          data?: string
          id?: string
          obs?: string | null
          propriedade_id: string
          sinais?: string | null
          updated_at?: string
        }
        Update: {
          acao?: string | null
          animal_id?: string
          created_at?: string
          data?: string
          id?: string
          obs?: string | null
          propriedade_id?: string
          sinais?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cios_animal_id_fkey"
            columns: ["animal_id"]
            isOneToOne: false
            referencedRelation: "animais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cios_propriedade_id_fkey"
            columns: ["propriedade_id"]
            isOneToOne: false
            referencedRelation: "propriedades"
            referencedColumns: ["id"]
          },
        ]
      }
      clientes: {
        Row: {
          ativo: boolean | null
          cidade: string | null
          created_at: string
          id: string
          nome: string
          obs: string | null
          propriedade_id: string
          telefone: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean | null
          cidade?: string | null
          created_at?: string
          id?: string
          nome: string
          obs?: string | null
          propriedade_id: string
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean | null
          cidade?: string | null
          created_at?: string
          id?: string
          nome?: string
          obs?: string | null
          propriedade_id?: string
          telefone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clientes_propriedade_id_fkey"
            columns: ["propriedade_id"]
            isOneToOne: false
            referencedRelation: "propriedades"
            referencedColumns: ["id"]
          },
        ]
      }
      clima_obs: {
        Row: {
          chuva_mm: number | null
          created_at: string
          data: string
          evento: string | null
          id: string
          obs: string | null
          propriedade_id: string
          temp_max: number | null
          temp_min: number | null
          updated_at: string
        }
        Insert: {
          chuva_mm?: number | null
          created_at?: string
          data?: string
          evento?: string | null
          id?: string
          obs?: string | null
          propriedade_id: string
          temp_max?: number | null
          temp_min?: number | null
          updated_at?: string
        }
        Update: {
          chuva_mm?: number | null
          created_at?: string
          data?: string
          evento?: string | null
          id?: string
          obs?: string | null
          propriedade_id?: string
          temp_max?: number | null
          temp_min?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clima_obs_propriedade_id_fkey"
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
      configuracoes_sistema: {
        Row: {
          atualizado_em: string
          atualizado_por: string | null
          chave: string
          valor: string | null
        }
        Insert: {
          atualizado_em?: string
          atualizado_por?: string | null
          chave: string
          valor?: string | null
        }
        Update: {
          atualizado_em?: string
          atualizado_por?: string | null
          chave?: string
          valor?: string | null
        }
        Relationships: []
      }
      contas: {
        Row: {
          categoria: string | null
          created_at: string
          descricao: string
          fornecedor_id: string | null
          id: string
          obs: string | null
          parte: string | null
          propriedade_id: string
          status: string
          tipo: string
          updated_at: string
          valor: number
          vencimento: string
        }
        Insert: {
          categoria?: string | null
          created_at?: string
          descricao: string
          fornecedor_id?: string | null
          id?: string
          obs?: string | null
          parte?: string | null
          propriedade_id: string
          status?: string
          tipo?: string
          updated_at?: string
          valor: number
          vencimento?: string
        }
        Update: {
          categoria?: string | null
          created_at?: string
          descricao?: string
          fornecedor_id?: string | null
          id?: string
          obs?: string | null
          parte?: string | null
          propriedade_id?: string
          status?: string
          tipo?: string
          updated_at?: string
          valor?: number
          vencimento?: string
        }
        Relationships: [
          {
            foreignKeyName: "contas_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contas_propriedade_id_fkey"
            columns: ["propriedade_id"]
            isOneToOne: false
            referencedRelation: "propriedades"
            referencedColumns: ["id"]
          },
        ]
      }
      cotacoes: {
        Row: {
          created_at: string
          data: string
          fonte: string | null
          id: string
          obs: string | null
          praca: string | null
          preco: number
          produto: string
          produto_outro: string | null
          propriedade_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          data?: string
          fonte?: string | null
          id?: string
          obs?: string | null
          praca?: string | null
          preco: number
          produto: string
          produto_outro?: string | null
          propriedade_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          data?: string
          fonte?: string | null
          id?: string
          obs?: string | null
          praca?: string | null
          preco?: number
          produto?: string
          produto_outro?: string | null
          propriedade_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cotacoes_propriedade_id_fkey"
            columns: ["propriedade_id"]
            isOneToOne: false
            referencedRelation: "propriedades"
            referencedColumns: ["id"]
          },
        ]
      }
      documentos: {
        Row: {
          animal_id: string | null
          categoria: string
          created_at: string
          emissao: string | null
          id: string
          nome: string
          numero: string | null
          obs: string | null
          propriedade_id: string
          updated_at: string
          vencimento: string | null
          vinculo: string | null
        }
        Insert: {
          animal_id?: string | null
          categoria: string
          created_at?: string
          emissao?: string | null
          id?: string
          nome: string
          numero?: string | null
          obs?: string | null
          propriedade_id: string
          updated_at?: string
          vencimento?: string | null
          vinculo?: string | null
        }
        Update: {
          animal_id?: string | null
          categoria?: string
          created_at?: string
          emissao?: string | null
          id?: string
          nome?: string
          numero?: string | null
          obs?: string | null
          propriedade_id?: string
          updated_at?: string
          vencimento?: string | null
          vinculo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documentos_animal_id_fkey"
            columns: ["animal_id"]
            isOneToOne: false
            referencedRelation: "animais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_propriedade_id_fkey"
            columns: ["propriedade_id"]
            isOneToOne: false
            referencedRelation: "propriedades"
            referencedColumns: ["id"]
          },
        ]
      }
      ebook_acessos: {
        Row: {
          criado_em: string
          ebook_id: string
          id: number
          ip_mascarado: string | null
          user_id: string
        }
        Insert: {
          criado_em?: string
          ebook_id: string
          id?: never
          ip_mascarado?: string | null
          user_id: string
        }
        Update: {
          criado_em?: string
          ebook_id?: string
          id?: never
          ip_mascarado?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ebook_acessos_ebook_id_fkey"
            columns: ["ebook_id"]
            isOneToOne: false
            referencedRelation: "ebooks"
            referencedColumns: ["id"]
          },
        ]
      }
      ebooks: {
        Row: {
          arquivo_path: string | null
          autor: string | null
          capa_path: string | null
          categoria: string | null
          created_at: string
          criado_por: string | null
          descricao: string | null
          id: string
          paginas: number | null
          publicado: boolean
          publicado_em: string | null
          sha256: string | null
          tamanho_bytes: number | null
          titulo: string
          updated_at: string
        }
        Insert: {
          arquivo_path?: string | null
          autor?: string | null
          capa_path?: string | null
          categoria?: string | null
          created_at?: string
          criado_por?: string | null
          descricao?: string | null
          id?: string
          paginas?: number | null
          publicado?: boolean
          publicado_em?: string | null
          sha256?: string | null
          tamanho_bytes?: number | null
          titulo: string
          updated_at?: string
        }
        Update: {
          arquivo_path?: string | null
          autor?: string | null
          capa_path?: string | null
          categoria?: string | null
          created_at?: string
          criado_por?: string | null
          descricao?: string | null
          id?: string
          paginas?: number | null
          publicado?: boolean
          publicado_em?: string | null
          sha256?: string | null
          tamanho_bytes?: number | null
          titulo?: string
          updated_at?: string
        }
        Relationships: []
      }
      engorda: {
        Row: {
          created_at: string
          custo_aquisicao: number | null
          data_entrada: string
          id: string
          lote_id: string
          obs: string | null
          peso_alvo: number | null
          preco_arroba: number | null
          propriedade_id: string
          rendimento: number | null
          saida_prevista: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          custo_aquisicao?: number | null
          data_entrada?: string
          id?: string
          lote_id: string
          obs?: string | null
          peso_alvo?: number | null
          preco_arroba?: number | null
          propriedade_id: string
          rendimento?: number | null
          saida_prevista?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          custo_aquisicao?: number | null
          data_entrada?: string
          id?: string
          lote_id?: string
          obs?: string | null
          peso_alvo?: number | null
          preco_arroba?: number | null
          propriedade_id?: string
          rendimento?: number | null
          saida_prevista?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "engorda_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: false
            referencedRelation: "lotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engorda_propriedade_id_fkey"
            columns: ["propriedade_id"]
            isOneToOne: false
            referencedRelation: "propriedades"
            referencedColumns: ["id"]
          },
        ]
      }
      estoque_itens: {
        Row: {
          ativo: boolean | null
          categoria: string
          conservacao: string | null
          controla_validade: boolean | null
          created_at: string
          fabricante: string | null
          fornecedor_id: string | null
          id: string
          minimo: number | null
          nome: string
          obs: string | null
          preco_ref: number | null
          propriedade_id: string
          unidade: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean | null
          categoria: string
          conservacao?: string | null
          controla_validade?: boolean | null
          created_at?: string
          fabricante?: string | null
          fornecedor_id?: string | null
          id?: string
          minimo?: number | null
          nome: string
          obs?: string | null
          preco_ref?: number | null
          propriedade_id: string
          unidade?: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean | null
          categoria?: string
          conservacao?: string | null
          controla_validade?: boolean | null
          created_at?: string
          fabricante?: string | null
          fornecedor_id?: string | null
          id?: string
          minimo?: number | null
          nome?: string
          obs?: string | null
          preco_ref?: number | null
          propriedade_id?: string
          unidade?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "estoque_itens_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estoque_itens_propriedade_id_fkey"
            columns: ["propriedade_id"]
            isOneToOne: false
            referencedRelation: "propriedades"
            referencedColumns: ["id"]
          },
        ]
      }
      estoque_mov: {
        Row: {
          animal_id: string | null
          created_at: string
          data: string
          fabricacao: string | null
          fornecedor_id: string | null
          id: string
          item_id: string
          lote_id: string | null
          lote_produto: string | null
          maquina_id: string | null
          motivo: string | null
          obs: string | null
          plantio_id: string | null
          propriedade_id: string
          qtd: number
          responsavel: string | null
          tipo: string
          updated_at: string
          validade: string | null
          valor_total: number | null
        }
        Insert: {
          animal_id?: string | null
          created_at?: string
          data?: string
          fabricacao?: string | null
          fornecedor_id?: string | null
          id?: string
          item_id: string
          lote_id?: string | null
          lote_produto?: string | null
          maquina_id?: string | null
          motivo?: string | null
          obs?: string | null
          plantio_id?: string | null
          propriedade_id: string
          qtd: number
          responsavel?: string | null
          tipo?: string
          updated_at?: string
          validade?: string | null
          valor_total?: number | null
        }
        Update: {
          animal_id?: string | null
          created_at?: string
          data?: string
          fabricacao?: string | null
          fornecedor_id?: string | null
          id?: string
          item_id?: string
          lote_id?: string | null
          lote_produto?: string | null
          maquina_id?: string | null
          motivo?: string | null
          obs?: string | null
          plantio_id?: string | null
          propriedade_id?: string
          qtd?: number
          responsavel?: string | null
          tipo?: string
          updated_at?: string
          validade?: string | null
          valor_total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "estoque_mov_animal_id_fkey"
            columns: ["animal_id"]
            isOneToOne: false
            referencedRelation: "animais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estoque_mov_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estoque_mov_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "estoque_itens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estoque_mov_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: false
            referencedRelation: "lotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estoque_mov_maquina_id_fkey"
            columns: ["maquina_id"]
            isOneToOne: false
            referencedRelation: "maquinas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estoque_mov_plantio_id_fkey"
            columns: ["plantio_id"]
            isOneToOne: false
            referencedRelation: "plantios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estoque_mov_propriedade_id_fkey"
            columns: ["propriedade_id"]
            isOneToOne: false
            referencedRelation: "propriedades"
            referencedColumns: ["id"]
          },
        ]
      }
      eventos_seguranca: {
        Row: {
          caminho: string | null
          criado_em: string
          detalhe: string | null
          id: number
          ip: string | null
          quantidade: number
          severidade: string
          tipo: string
        }
        Insert: {
          caminho?: string | null
          criado_em?: string
          detalhe?: string | null
          id?: number
          ip?: string | null
          quantidade?: number
          severidade?: string
          tipo: string
        }
        Update: {
          caminho?: string | null
          criado_em?: string
          detalhe?: string | null
          id?: number
          ip?: string | null
          quantidade?: number
          severidade?: string
          tipo?: string
        }
        Relationships: []
      }
      fornecedores: {
        Row: {
          ativo: boolean | null
          categoria: string
          cidade: string | null
          condicoes: string | null
          contato: string | null
          created_at: string
          email: string | null
          id: string
          nome: string
          obs: string | null
          propriedade_id: string
          telefone: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean | null
          categoria: string
          cidade?: string | null
          condicoes?: string | null
          contato?: string | null
          created_at?: string
          email?: string | null
          id?: string
          nome: string
          obs?: string | null
          propriedade_id: string
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean | null
          categoria?: string
          cidade?: string | null
          condicoes?: string | null
          contato?: string | null
          created_at?: string
          email?: string | null
          id?: string
          nome?: string
          obs?: string | null
          propriedade_id?: string
          telefone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fornecedores_propriedade_id_fkey"
            columns: ["propriedade_id"]
            isOneToOne: false
            referencedRelation: "propriedades"
            referencedColumns: ["id"]
          },
        ]
      }
      funcionarios: {
        Row: {
          admissao: string | null
          created_at: string
          funcao: string
          id: string
          nome: string
          obs: string | null
          propriedade_id: string
          salario: number | null
          setor: string | null
          situacao: string
          telefone: string | null
          updated_at: string
        }
        Insert: {
          admissao?: string | null
          created_at?: string
          funcao: string
          id?: string
          nome: string
          obs?: string | null
          propriedade_id: string
          salario?: number | null
          setor?: string | null
          situacao?: string
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          admissao?: string | null
          created_at?: string
          funcao?: string
          id?: string
          nome?: string
          obs?: string | null
          propriedade_id?: string
          salario?: number | null
          setor?: string | null
          situacao?: string
          telefone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "funcionarios_propriedade_id_fkey"
            columns: ["propriedade_id"]
            isOneToOne: false
            referencedRelation: "propriedades"
            referencedColumns: ["id"]
          },
        ]
      }
      gta: {
        Row: {
          created_at: string
          destino: string
          emissao: string
          especie: string | null
          finalidade: string
          id: string
          lote_id: string | null
          numero: string
          obs: string | null
          origem: string | null
          propriedade_id: string
          qtd: number
          situacao: string
          updated_at: string
          validade: string
        }
        Insert: {
          created_at?: string
          destino: string
          emissao?: string
          especie?: string | null
          finalidade: string
          id?: string
          lote_id?: string | null
          numero: string
          obs?: string | null
          origem?: string | null
          propriedade_id: string
          qtd: number
          situacao?: string
          updated_at?: string
          validade: string
        }
        Update: {
          created_at?: string
          destino?: string
          emissao?: string
          especie?: string | null
          finalidade?: string
          id?: string
          lote_id?: string | null
          numero?: string
          obs?: string | null
          origem?: string | null
          propriedade_id?: string
          qtd?: number
          situacao?: string
          updated_at?: string
          validade?: string
        }
        Relationships: [
          {
            foreignKeyName: "gta_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: false
            referencedRelation: "lotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gta_propriedade_id_fkey"
            columns: ["propriedade_id"]
            isOneToOne: false
            referencedRelation: "propriedades"
            referencedColumns: ["id"]
          },
        ]
      }
      horas_trabalho: {
        Row: {
          atividade: string | null
          created_at: string
          data: string
          funcionario_id: string
          horas: number | null
          id: string
          obs: string | null
          pago: boolean | null
          propriedade_id: string
          tipo: string
          updated_at: string
          valor: number | null
        }
        Insert: {
          atividade?: string | null
          created_at?: string
          data?: string
          funcionario_id: string
          horas?: number | null
          id?: string
          obs?: string | null
          pago?: boolean | null
          propriedade_id: string
          tipo?: string
          updated_at?: string
          valor?: number | null
        }
        Update: {
          atividade?: string | null
          created_at?: string
          data?: string
          funcionario_id?: string
          horas?: number | null
          id?: string
          obs?: string | null
          pago?: boolean | null
          propriedade_id?: string
          tipo?: string
          updated_at?: string
          valor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "horas_trabalho_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "horas_trabalho_propriedade_id_fkey"
            columns: ["propriedade_id"]
            isOneToOne: false
            referencedRelation: "propriedades"
            referencedColumns: ["id"]
          },
        ]
      }
      imagens_site: {
        Row: {
          atualizado_em: string
          atualizado_por: string | null
          chave: string
          valor: string
        }
        Insert: {
          atualizado_em?: string
          atualizado_por?: string | null
          chave: string
          valor: string
        }
        Update: {
          atualizado_em?: string
          atualizado_por?: string | null
          chave?: string
          valor?: string
        }
        Relationships: []
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
      incidentes_seguranca: {
        Row: {
          agente: string | null
          bloqueou: boolean
          caminho: string | null
          criado_em: string
          detalhes: Json
          dispositivo: string | null
          id: string
          ip: string | null
          metodo: string | null
          motivo: string
          repeticoes: number
          severidade: string
          tipo: string
          user_id: string | null
        }
        Insert: {
          agente?: string | null
          bloqueou?: boolean
          caminho?: string | null
          criado_em?: string
          detalhes?: Json
          dispositivo?: string | null
          id?: string
          ip?: string | null
          metodo?: string | null
          motivo: string
          repeticoes?: number
          severidade?: string
          tipo: string
          user_id?: string | null
        }
        Update: {
          agente?: string | null
          bloqueou?: boolean
          caminho?: string | null
          criado_em?: string
          detalhes?: Json
          dispositivo?: string | null
          id?: string
          ip?: string | null
          metodo?: string | null
          motivo?: string
          repeticoes?: number
          severidade?: string
          tipo?: string
          user_id?: string | null
        }
        Relationships: []
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
      instalacoes: {
        Row: {
          ativo: boolean | null
          capacidade: string | null
          created_at: string
          id: string
          nome: string
          obs: string | null
          propriedade_id: string
          tipo: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean | null
          capacidade?: string | null
          created_at?: string
          id?: string
          nome: string
          obs?: string | null
          propriedade_id: string
          tipo: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean | null
          capacidade?: string | null
          created_at?: string
          id?: string
          nome?: string
          obs?: string | null
          propriedade_id?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "instalacoes_propriedade_id_fkey"
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
      irrig_manut: {
        Row: {
          created_at: string
          data: string
          descricao: string
          id: string
          obs: string | null
          propriedade_id: string
          proxima_data: string | null
          sistema_id: string
          tipo: string | null
          updated_at: string
          valor: number | null
        }
        Insert: {
          created_at?: string
          data?: string
          descricao: string
          id?: string
          obs?: string | null
          propriedade_id: string
          proxima_data?: string | null
          sistema_id: string
          tipo?: string | null
          updated_at?: string
          valor?: number | null
        }
        Update: {
          created_at?: string
          data?: string
          descricao?: string
          id?: string
          obs?: string | null
          propriedade_id?: string
          proxima_data?: string | null
          sistema_id?: string
          tipo?: string | null
          updated_at?: string
          valor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "irrig_manut_propriedade_id_fkey"
            columns: ["propriedade_id"]
            isOneToOne: false
            referencedRelation: "propriedades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "irrig_manut_sistema_id_fkey"
            columns: ["sistema_id"]
            isOneToOne: false
            referencedRelation: "irrig_sistemas"
            referencedColumns: ["id"]
          },
        ]
      }
      irrig_sistemas: {
        Row: {
          area_ha: number | null
          capacidade: number | null
          created_at: string
          fonte: string | null
          id: string
          nome: string
          obs: string | null
          propriedade_id: string
          situacao: string | null
          tipo: string
          updated_at: string
        }
        Insert: {
          area_ha?: number | null
          capacidade?: number | null
          created_at?: string
          fonte?: string | null
          id?: string
          nome: string
          obs?: string | null
          propriedade_id: string
          situacao?: string | null
          tipo: string
          updated_at?: string
        }
        Update: {
          area_ha?: number | null
          capacidade?: number | null
          created_at?: string
          fonte?: string | null
          id?: string
          nome?: string
          obs?: string | null
          propriedade_id?: string
          situacao?: string | null
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "irrig_sistemas_propriedade_id_fkey"
            columns: ["propriedade_id"]
            isOneToOne: false
            referencedRelation: "propriedades"
            referencedColumns: ["id"]
          },
        ]
      }
      irrigacoes: {
        Row: {
          created_at: string
          data: string
          horas: number | null
          id: string
          obs: string | null
          propriedade_id: string
          sistema_id: string
          talhao_id: string | null
          updated_at: string
          volume: number | null
        }
        Insert: {
          created_at?: string
          data?: string
          horas?: number | null
          id?: string
          obs?: string | null
          propriedade_id: string
          sistema_id: string
          talhao_id?: string | null
          updated_at?: string
          volume?: number | null
        }
        Update: {
          created_at?: string
          data?: string
          horas?: number | null
          id?: string
          obs?: string | null
          propriedade_id?: string
          sistema_id?: string
          talhao_id?: string | null
          updated_at?: string
          volume?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "irrigacoes_propriedade_id_fkey"
            columns: ["propriedade_id"]
            isOneToOne: false
            referencedRelation: "propriedades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "irrigacoes_sistema_id_fkey"
            columns: ["sistema_id"]
            isOneToOne: false
            referencedRelation: "irrig_sistemas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "irrigacoes_talhao_id_fkey"
            columns: ["talhao_id"]
            isOneToOne: false
            referencedRelation: "talhoes"
            referencedColumns: ["id"]
          },
        ]
      }
      lancamentos: {
        Row: {
          animal_id: string | null
          categoria: string
          created_at: string
          data: string
          descricao: string
          id: string
          lote_id: string | null
          maquina_id: string | null
          obs: string | null
          pasto_id: string | null
          plantio_id: string | null
          propriedade_id: string
          tipo: string
          updated_at: string
          valor: number
        }
        Insert: {
          animal_id?: string | null
          categoria: string
          created_at?: string
          data?: string
          descricao: string
          id?: string
          lote_id?: string | null
          maquina_id?: string | null
          obs?: string | null
          pasto_id?: string | null
          plantio_id?: string | null
          propriedade_id: string
          tipo?: string
          updated_at?: string
          valor: number
        }
        Update: {
          animal_id?: string | null
          categoria?: string
          created_at?: string
          data?: string
          descricao?: string
          id?: string
          lote_id?: string | null
          maquina_id?: string | null
          obs?: string | null
          pasto_id?: string | null
          plantio_id?: string | null
          propriedade_id?: string
          tipo?: string
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "lancamentos_animal_id_fkey"
            columns: ["animal_id"]
            isOneToOne: false
            referencedRelation: "animais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamentos_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: false
            referencedRelation: "lotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamentos_maquina_id_fkey"
            columns: ["maquina_id"]
            isOneToOne: false
            referencedRelation: "maquinas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamentos_pasto_id_fkey"
            columns: ["pasto_id"]
            isOneToOne: false
            referencedRelation: "pastos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamentos_plantio_id_fkey"
            columns: ["plantio_id"]
            isOneToOne: false
            referencedRelation: "plantios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamentos_propriedade_id_fkey"
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
      manutencao_config: {
        Row: {
          atualizado_em: string
          atualizado_por: string | null
          duracao_bloqueio_min: number
          id: number
          mensagem: string
          modulos: string[]
          status: string
          termina_em: string | null
          titulo: string
        }
        Insert: {
          atualizado_em?: string
          atualizado_por?: string | null
          duracao_bloqueio_min?: number
          id?: number
          mensagem?: string
          modulos?: string[]
          status?: string
          termina_em?: string | null
          titulo?: string
        }
        Update: {
          atualizado_em?: string
          atualizado_por?: string | null
          duracao_bloqueio_min?: number
          id?: number
          mensagem?: string
          modulos?: string[]
          status?: string
          termina_em?: string | null
          titulo?: string
        }
        Relationships: []
      }
      manutencao_historico: {
        Row: {
          criado_em: string
          detalhes: Json
          email: string | null
          id: string
          ip: string | null
          status_anterior: string | null
          status_novo: string
          user_id: string | null
        }
        Insert: {
          criado_em?: string
          detalhes?: Json
          email?: string | null
          id?: string
          ip?: string | null
          status_anterior?: string | null
          status_novo: string
          user_id?: string | null
        }
        Update: {
          criado_em?: string
          detalhes?: Json
          email?: string | null
          id?: string
          ip?: string | null
          status_anterior?: string | null
          status_novo?: string
          user_id?: string | null
        }
        Relationships: []
      }
      manutencoes: {
        Row: {
          created_at: string
          data: string
          horimetro: number | null
          id: string
          km: number | null
          litros: number | null
          maquina_id: string
          obs: string | null
          oficina: string | null
          pecas: string | null
          propriedade_id: string
          proxima_data: string | null
          proxima_horas: number | null
          tipo: string
          updated_at: string
          valor: number | null
        }
        Insert: {
          created_at?: string
          data?: string
          horimetro?: number | null
          id?: string
          km?: number | null
          litros?: number | null
          maquina_id: string
          obs?: string | null
          oficina?: string | null
          pecas?: string | null
          propriedade_id: string
          proxima_data?: string | null
          proxima_horas?: number | null
          tipo?: string
          updated_at?: string
          valor?: number | null
        }
        Update: {
          created_at?: string
          data?: string
          horimetro?: number | null
          id?: string
          km?: number | null
          litros?: number | null
          maquina_id?: string
          obs?: string | null
          oficina?: string | null
          pecas?: string | null
          propriedade_id?: string
          proxima_data?: string | null
          proxima_horas?: number | null
          tipo?: string
          updated_at?: string
          valor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "manutencoes_maquina_id_fkey"
            columns: ["maquina_id"]
            isOneToOne: false
            referencedRelation: "maquinas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manutencoes_propriedade_id_fkey"
            columns: ["propriedade_id"]
            isOneToOne: false
            referencedRelation: "propriedades"
            referencedColumns: ["id"]
          },
        ]
      }
      maquinas: {
        Row: {
          ano: number | null
          aquisicao_data: string | null
          aquisicao_valor: number | null
          created_at: string
          horimetro: number | null
          id: string
          intervalo_revisao: number | null
          km: number | null
          marca: string | null
          modelo: string | null
          nome: string
          obs: string | null
          operadores: string | null
          propriedade_id: string
          serie: string | null
          situacao: string
          tipo: string
          updated_at: string
        }
        Insert: {
          ano?: number | null
          aquisicao_data?: string | null
          aquisicao_valor?: number | null
          created_at?: string
          horimetro?: number | null
          id?: string
          intervalo_revisao?: number | null
          km?: number | null
          marca?: string | null
          modelo?: string | null
          nome: string
          obs?: string | null
          operadores?: string | null
          propriedade_id: string
          serie?: string | null
          situacao?: string
          tipo: string
          updated_at?: string
        }
        Update: {
          ano?: number | null
          aquisicao_data?: string | null
          aquisicao_valor?: number | null
          created_at?: string
          horimetro?: number | null
          id?: string
          intervalo_revisao?: number | null
          km?: number | null
          marca?: string | null
          modelo?: string | null
          nome?: string
          obs?: string | null
          operadores?: string | null
          propriedade_id?: string
          serie?: string | null
          situacao?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "maquinas_propriedade_id_fkey"
            columns: ["propriedade_id"]
            isOneToOne: false
            referencedRelation: "propriedades"
            referencedColumns: ["id"]
          },
        ]
      }
      mov_animais: {
        Row: {
          animal_id: string | null
          created_at: string
          data: string
          de: string | null
          id: string
          lote_id: string | null
          obs: string | null
          para: string | null
          propriedade_id: string
          responsavel: string | null
          tipo: string
          updated_at: string
        }
        Insert: {
          animal_id?: string | null
          created_at?: string
          data?: string
          de?: string | null
          id?: string
          lote_id?: string | null
          obs?: string | null
          para?: string | null
          propriedade_id: string
          responsavel?: string | null
          tipo: string
          updated_at?: string
        }
        Update: {
          animal_id?: string | null
          created_at?: string
          data?: string
          de?: string | null
          id?: string
          lote_id?: string | null
          obs?: string | null
          para?: string | null
          propriedade_id?: string
          responsavel?: string | null
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mov_animais_animal_id_fkey"
            columns: ["animal_id"]
            isOneToOne: false
            referencedRelation: "animais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mov_animais_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: false
            referencedRelation: "lotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mov_animais_propriedade_id_fkey"
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
          chave: string | null
          created_at: string
          id: string
          lida: boolean
          mensagem: string
          propriedade_id: string | null
          titulo: string
          user_id: string
        }
        Insert: {
          chave?: string | null
          created_at?: string
          id?: string
          lida?: boolean
          mensagem: string
          propriedade_id?: string | null
          titulo: string
          user_id: string
        }
        Update: {
          chave?: string | null
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
      ocorr_reprod: {
        Row: {
          animal_id: string
          created_at: string
          data: string
          descricao: string | null
          id: string
          obs: string | null
          propriedade_id: string
          tipo: string
          updated_at: string
        }
        Insert: {
          animal_id: string
          created_at?: string
          data?: string
          descricao?: string | null
          id?: string
          obs?: string | null
          propriedade_id: string
          tipo: string
          updated_at?: string
        }
        Update: {
          animal_id?: string
          created_at?: string
          data?: string
          descricao?: string | null
          id?: string
          obs?: string | null
          propriedade_id?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ocorr_reprod_animal_id_fkey"
            columns: ["animal_id"]
            isOneToOne: false
            referencedRelation: "animais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ocorr_reprod_propriedade_id_fkey"
            columns: ["propriedade_id"]
            isOneToOne: false
            referencedRelation: "propriedades"
            referencedColumns: ["id"]
          },
        ]
      }
      ocorrencias: {
        Row: {
          created_at: string
          data: string
          descricao: string | null
          gravidade: string | null
          id: string
          propriedade_id: string
          responsavel_id: string | null
          setor: string | null
          status: string
          titulo: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          data?: string
          descricao?: string | null
          gravidade?: string | null
          id?: string
          propriedade_id: string
          responsavel_id?: string | null
          setor?: string | null
          status?: string
          titulo: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          data?: string
          descricao?: string | null
          gravidade?: string | null
          id?: string
          propriedade_id?: string
          responsavel_id?: string | null
          setor?: string | null
          status?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ocorrencias_propriedade_id_fkey"
            columns: ["propriedade_id"]
            isOneToOne: false
            referencedRelation: "propriedades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ocorrencias_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
        ]
      }
      pagamentos: {
        Row: {
          aprovado_em: string | null
          atualizado_em: string
          criado_em: string
          detalhes: Json
          estornado_em: string | null
          id: string
          meses: number
          metodo: string | null
          moeda: string
          mp_payment_id: string | null
          mp_preference_id: string | null
          plano_id: string | null
          plano_nome: string
          propriedade_id: string
          status: string
          user_id: string
          valor_centavos: number
        }
        Insert: {
          aprovado_em?: string | null
          atualizado_em?: string
          criado_em?: string
          detalhes?: Json
          estornado_em?: string | null
          id?: string
          meses: number
          metodo?: string | null
          moeda?: string
          mp_payment_id?: string | null
          mp_preference_id?: string | null
          plano_id?: string | null
          plano_nome: string
          propriedade_id: string
          status?: string
          user_id: string
          valor_centavos: number
        }
        Update: {
          aprovado_em?: string | null
          atualizado_em?: string
          criado_em?: string
          detalhes?: Json
          estornado_em?: string | null
          id?: string
          meses?: number
          metodo?: string | null
          moeda?: string
          mp_payment_id?: string | null
          mp_preference_id?: string | null
          plano_id?: string | null
          plano_nome?: string
          propriedade_id?: string
          status?: string
          user_id?: string
          valor_centavos?: number
        }
        Relationships: [
          {
            foreignKeyName: "pagamentos_plano_id_fkey"
            columns: ["plano_id"]
            isOneToOne: false
            referencedRelation: "planos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagamentos_propriedade_id_fkey"
            columns: ["propriedade_id"]
            isOneToOne: false
            referencedRelation: "propriedades"
            referencedColumns: ["id"]
          },
        ]
      }
      pasto_mov: {
        Row: {
          created_at: string
          entrada: string
          id: string
          lote_id: string
          obs: string | null
          pasto_id: string
          propriedade_id: string
          qtd_animais: number | null
          saida: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          entrada?: string
          id?: string
          lote_id: string
          obs?: string | null
          pasto_id: string
          propriedade_id: string
          qtd_animais?: number | null
          saida?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          entrada?: string
          id?: string
          lote_id?: string
          obs?: string | null
          pasto_id?: string
          propriedade_id?: string
          qtd_animais?: number | null
          saida?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pasto_mov_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: false
            referencedRelation: "lotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pasto_mov_pasto_id_fkey"
            columns: ["pasto_id"]
            isOneToOne: false
            referencedRelation: "pastos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pasto_mov_propriedade_id_fkey"
            columns: ["propriedade_id"]
            isOneToOne: false
            referencedRelation: "propriedades"
            referencedColumns: ["id"]
          },
        ]
      }
      pastos: {
        Row: {
          area_ha: number
          capacidade: number | null
          created_at: string
          forrageira: string | null
          id: string
          nome: string
          obs: string | null
          propriedade_id: string
          situacao: string
          ultima_adubacao: string | null
          ultima_reforma: string | null
          updated_at: string
        }
        Insert: {
          area_ha: number
          capacidade?: number | null
          created_at?: string
          forrageira?: string | null
          id?: string
          nome: string
          obs?: string | null
          propriedade_id: string
          situacao?: string
          ultima_adubacao?: string | null
          ultima_reforma?: string | null
          updated_at?: string
        }
        Update: {
          area_ha?: number
          capacidade?: number | null
          created_at?: string
          forrageira?: string | null
          id?: string
          nome?: string
          obs?: string | null
          propriedade_id?: string
          situacao?: string
          ultima_adubacao?: string | null
          ultima_reforma?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pastos_propriedade_id_fkey"
            columns: ["propriedade_id"]
            isOneToOne: false
            referencedRelation: "propriedades"
            referencedColumns: ["id"]
          },
        ]
      }
      pedidos_compra: {
        Row: {
          created_at: string
          data: string
          descricao: string
          entrega_prevista: string | null
          fornecedor_id: string
          id: string
          item_id: string | null
          obs: string | null
          pagamento: string
          propriedade_id: string
          qtd: number | null
          status: string
          updated_at: string
          valor: number | null
          vencimento_pgto: string | null
        }
        Insert: {
          created_at?: string
          data?: string
          descricao: string
          entrega_prevista?: string | null
          fornecedor_id: string
          id?: string
          item_id?: string | null
          obs?: string | null
          pagamento?: string
          propriedade_id: string
          qtd?: number | null
          status?: string
          updated_at?: string
          valor?: number | null
          vencimento_pgto?: string | null
        }
        Update: {
          created_at?: string
          data?: string
          descricao?: string
          entrega_prevista?: string | null
          fornecedor_id?: string
          id?: string
          item_id?: string | null
          obs?: string | null
          pagamento?: string
          propriedade_id?: string
          qtd?: number | null
          status?: string
          updated_at?: string
          valor?: number | null
          vencimento_pgto?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pedidos_compra_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_compra_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "estoque_itens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_compra_propriedade_id_fkey"
            columns: ["propriedade_id"]
            isOneToOne: false
            referencedRelation: "propriedades"
            referencedColumns: ["id"]
          },
        ]
      }
      pedidos_venda: {
        Row: {
          cliente_id: string
          created_at: string
          data: string
          entrega_prevista: string | null
          id: string
          item_id: string | null
          obs: string | null
          pagamento: string
          preco_unit: number | null
          produto: string
          propriedade_id: string
          qtd: number
          status: string
          unidade: string | null
          updated_at: string
        }
        Insert: {
          cliente_id: string
          created_at?: string
          data?: string
          entrega_prevista?: string | null
          id?: string
          item_id?: string | null
          obs?: string | null
          pagamento?: string
          preco_unit?: number | null
          produto: string
          propriedade_id: string
          qtd: number
          status?: string
          unidade?: string | null
          updated_at?: string
        }
        Update: {
          cliente_id?: string
          created_at?: string
          data?: string
          entrega_prevista?: string | null
          id?: string
          item_id?: string | null
          obs?: string | null
          pagamento?: string
          preco_unit?: number | null
          produto?: string
          propriedade_id?: string
          qtd?: number
          status?: string
          unidade?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pedidos_venda_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_venda_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "estoque_itens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_venda_propriedade_id_fkey"
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
      planos: {
        Row: {
          ativo: boolean
          atualizado_em: string
          criado_em: string
          descricao: string | null
          id: string
          meses: number
          nome: string
          ordem: number
          preco_centavos: number
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          criado_em?: string
          descricao?: string | null
          id?: string
          meses: number
          nome: string
          ordem?: number
          preco_centavos?: number
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          criado_em?: string
          descricao?: string | null
          id?: string
          meses?: number
          nome?: string
          ordem?: number
          preco_centavos?: number
        }
        Relationships: []
      }
      planos_alim: {
        Row: {
          ativo: boolean | null
          categoria_animal: string | null
          created_at: string
          fim: string | null
          id: string
          inicio: string | null
          item_id: string
          lote_id: string | null
          nome: string
          orientacao: string | null
          propriedade_id: string
          qtd_animal_dia: number
          updated_at: string
        }
        Insert: {
          ativo?: boolean | null
          categoria_animal?: string | null
          created_at?: string
          fim?: string | null
          id?: string
          inicio?: string | null
          item_id: string
          lote_id?: string | null
          nome: string
          orientacao?: string | null
          propriedade_id: string
          qtd_animal_dia: number
          updated_at?: string
        }
        Update: {
          ativo?: boolean | null
          categoria_animal?: string | null
          created_at?: string
          fim?: string | null
          id?: string
          inicio?: string | null
          item_id?: string
          lote_id?: string | null
          nome?: string
          orientacao?: string | null
          propriedade_id?: string
          qtd_animal_dia?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "planos_alim_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "estoque_itens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planos_alim_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: false
            referencedRelation: "lotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planos_alim_propriedade_id_fkey"
            columns: ["propriedade_id"]
            isOneToOne: false
            referencedRelation: "propriedades"
            referencedColumns: ["id"]
          },
        ]
      }
      plantios: {
        Row: {
          area_ha: number | null
          colheita_prevista: string | null
          created_at: string
          cultura: string
          id: string
          obs: string | null
          plantio_data: string | null
          producao_esperada: number | null
          propriedade_id: string
          safra: string
          status: string
          talhao_id: string
          updated_at: string
          variedade: string | null
        }
        Insert: {
          area_ha?: number | null
          colheita_prevista?: string | null
          created_at?: string
          cultura: string
          id?: string
          obs?: string | null
          plantio_data?: string | null
          producao_esperada?: number | null
          propriedade_id: string
          safra: string
          status?: string
          talhao_id: string
          updated_at?: string
          variedade?: string | null
        }
        Update: {
          area_ha?: number | null
          colheita_prevista?: string | null
          created_at?: string
          cultura?: string
          id?: string
          obs?: string | null
          plantio_data?: string | null
          producao_esperada?: number | null
          propriedade_id?: string
          safra?: string
          status?: string
          talhao_id?: string
          updated_at?: string
          variedade?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "plantios_propriedade_id_fkey"
            columns: ["propriedade_id"]
            isOneToOne: false
            referencedRelation: "propriedades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plantios_talhao_id_fkey"
            columns: ["talhao_id"]
            isOneToOne: false
            referencedRelation: "talhoes"
            referencedColumns: ["id"]
          },
        ]
      }
      presenca_usuarios: {
        Row: {
          pagina: string | null
          user_id: string
          visto_em: string
        }
        Insert: {
          pagina?: string | null
          user_id: string
          visto_em?: string
        }
        Update: {
          pagina?: string | null
          user_id?: string
          visto_em?: string
        }
        Relationships: []
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
      qualidade_leite: {
        Row: {
          ccs: number | null
          cpp: number | null
          created_at: string
          data: string
          gordura: number | null
          id: string
          laboratorio: string | null
          obs: string | null
          propriedade_id: string
          proteina: number | null
          temperatura: number | null
          updated_at: string
        }
        Insert: {
          ccs?: number | null
          cpp?: number | null
          created_at?: string
          data?: string
          gordura?: number | null
          id?: string
          laboratorio?: string | null
          obs?: string | null
          propriedade_id: string
          proteina?: number | null
          temperatura?: number | null
          updated_at?: string
        }
        Update: {
          ccs?: number | null
          cpp?: number | null
          created_at?: string
          data?: string
          gordura?: number | null
          id?: string
          laboratorio?: string | null
          obs?: string | null
          propriedade_id?: string
          proteina?: number | null
          temperatura?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "qualidade_leite_propriedade_id_fkey"
            columns: ["propriedade_id"]
            isOneToOne: false
            referencedRelation: "propriedades"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limits: {
        Row: {
          chave: string
          contador: number
          janela: string
          termina_em: string | null
        }
        Insert: {
          chave: string
          contador?: number
          janela: string
          termina_em?: string | null
        }
        Update: {
          chave?: string
          contador?: number
          janela?: string
          termina_em?: string | null
        }
        Relationships: []
      }
      registros_excluidos: {
        Row: {
          excluido_em: string
          id: number
          propriedade_id: string
          registro_id: string
          tabela: string
        }
        Insert: {
          excluido_em?: string
          id?: never
          propriedade_id: string
          registro_id: string
          tabela: string
        }
        Update: {
          excluido_em?: string
          id?: never
          propriedade_id?: string
          registro_id?: string
          tabela?: string
        }
        Relationships: []
      }
      solicitacoes_exclusao: {
        Row: {
          atendida_por: string | null
          concluida_em: string | null
          criado_em: string
          email: string | null
          id: string
          motivo: string | null
          prazo: string
          status: string
          user_id: string
        }
        Insert: {
          atendida_por?: string | null
          concluida_em?: string | null
          criado_em?: string
          email?: string | null
          id?: string
          motivo?: string | null
          prazo?: string
          status?: string
          user_id?: string
        }
        Update: {
          atendida_por?: string | null
          concluida_em?: string | null
          criado_em?: string
          email?: string | null
          id?: string
          motivo?: string | null
          prazo?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      suporte_contatos: {
        Row: {
          assunto: string
          criado_em: string
          email: string | null
          id: string
          mensagem: string
          propriedade_id: string | null
          respondido_em: string | null
          respondido_por: string | null
          resposta: string | null
          status: string
          user_id: string
        }
        Insert: {
          assunto: string
          criado_em?: string
          email?: string | null
          id?: string
          mensagem: string
          propriedade_id?: string | null
          respondido_em?: string | null
          respondido_por?: string | null
          resposta?: string | null
          status?: string
          user_id?: string
        }
        Update: {
          assunto?: string
          criado_em?: string
          email?: string | null
          id?: string
          mensagem?: string
          propriedade_id?: string | null
          respondido_em?: string | null
          respondido_por?: string | null
          resposta?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "suporte_contatos_propriedade_id_fkey"
            columns: ["propriedade_id"]
            isOneToOne: false
            referencedRelation: "propriedades"
            referencedColumns: ["id"]
          },
        ]
      }
      suporte_mensagens: {
        Row: {
          created_at: string
          id: string
          mensagem_id: string
          papel: string
          partes: Json
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          mensagem_id: string
          papel: string
          partes?: Json
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          mensagem_id?: string
          papel?: string
          partes?: Json
          user_id?: string
        }
        Relationships: []
      }
      talhoes: {
        Row: {
          area_ha: number
          created_at: string
          id: string
          nome: string
          obs: string | null
          propriedade_id: string
          situacao: string | null
          solo: string | null
          updated_at: string
        }
        Insert: {
          area_ha: number
          created_at?: string
          id?: string
          nome: string
          obs?: string | null
          propriedade_id: string
          situacao?: string | null
          solo?: string | null
          updated_at?: string
        }
        Update: {
          area_ha?: number
          created_at?: string
          id?: string
          nome?: string
          obs?: string | null
          propriedade_id?: string
          situacao?: string | null
          solo?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "talhoes_propriedade_id_fkey"
            columns: ["propriedade_id"]
            isOneToOne: false
            referencedRelation: "propriedades"
            referencedColumns: ["id"]
          },
        ]
      }
      tarefas: {
        Row: {
          animal_id: string | null
          created_at: string
          data: string
          id: string
          lote_id: string | null
          obs: string | null
          prioridade: string
          propriedade_id: string
          repete: string | null
          responsavel_id: string | null
          setor: string | null
          status: string
          tipo: string
          titulo: string
          updated_at: string
        }
        Insert: {
          animal_id?: string | null
          created_at?: string
          data?: string
          id?: string
          lote_id?: string | null
          obs?: string | null
          prioridade?: string
          propriedade_id: string
          repete?: string | null
          responsavel_id?: string | null
          setor?: string | null
          status?: string
          tipo?: string
          titulo: string
          updated_at?: string
        }
        Update: {
          animal_id?: string | null
          created_at?: string
          data?: string
          id?: string
          lote_id?: string | null
          obs?: string | null
          prioridade?: string
          propriedade_id?: string
          repete?: string | null
          responsavel_id?: string | null
          setor?: string | null
          status?: string
          tipo?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tarefas_animal_id_fkey"
            columns: ["animal_id"]
            isOneToOne: false
            referencedRelation: "animais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarefas_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: false
            referencedRelation: "lotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarefas_propriedade_id_fkey"
            columns: ["propriedade_id"]
            isOneToOne: false
            referencedRelation: "propriedades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarefas_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
        ]
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
      tratamentos: {
        Row: {
          animal_id: string | null
          carencia_carne: number | null
          carencia_leite: number | null
          created_at: string
          custo: number | null
          data: string
          descricao: string
          dose: string | null
          fabricante: string | null
          id: string
          item_id: string | null
          lote_id: string | null
          lote_produto: string | null
          medicamento: string | null
          orientacao: string | null
          propriedade_id: string
          qtd_usada: number | null
          responsavel: string | null
          retorno: string | null
          status: string
          tipo: string
          updated_at: string
          veterinario: string | null
          via: string | null
        }
        Insert: {
          animal_id?: string | null
          carencia_carne?: number | null
          carencia_leite?: number | null
          created_at?: string
          custo?: number | null
          data?: string
          descricao: string
          dose?: string | null
          fabricante?: string | null
          id?: string
          item_id?: string | null
          lote_id?: string | null
          lote_produto?: string | null
          medicamento?: string | null
          orientacao?: string | null
          propriedade_id: string
          qtd_usada?: number | null
          responsavel?: string | null
          retorno?: string | null
          status?: string
          tipo?: string
          updated_at?: string
          veterinario?: string | null
          via?: string | null
        }
        Update: {
          animal_id?: string | null
          carencia_carne?: number | null
          carencia_leite?: number | null
          created_at?: string
          custo?: number | null
          data?: string
          descricao?: string
          dose?: string | null
          fabricante?: string | null
          id?: string
          item_id?: string | null
          lote_id?: string | null
          lote_produto?: string | null
          medicamento?: string | null
          orientacao?: string | null
          propriedade_id?: string
          qtd_usada?: number | null
          responsavel?: string | null
          retorno?: string | null
          status?: string
          tipo?: string
          updated_at?: string
          veterinario?: string | null
          via?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tratamentos_animal_id_fkey"
            columns: ["animal_id"]
            isOneToOne: false
            referencedRelation: "animais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tratamentos_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "estoque_itens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tratamentos_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: false
            referencedRelation: "lotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tratamentos_propriedade_id_fkey"
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
      yui_uso: {
        Row: {
          dia: string
          falas: number
          mensagens: number
          user_id: string
        }
        Insert: {
          dia: string
          falas?: number
          mensagens?: number
          user_id: string
        }
        Update: {
          dia?: string
          falas?: number
          mensagens?: number
          user_id?: string
        }
        Relationships: []
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
          status_atual: string | null
          status_calculado: string | null
          tipo_vacina_id: string | null
          ultima_dose: boolean | null
          updated_at: string | null
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
      admin_2fa_resumo: {
        Args: never
        Returns: {
          email: string
          eu: boolean
          tem_2fa: boolean
        }[]
      }
      admin_alertas: { Args: never; Returns: Json }
      admin_bloquear: {
        Args: {
          _minutos?: number
          _motivo?: string
          _tipo: string
          _valor: string
        }
        Returns: Json
      }
      admin_concluir_exclusao: { Args: { _id: string }; Returns: Json }
      admin_conta_detalhe: { Args: { _user_id: string }; Returns: Json }
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
      admin_definir_perfil: {
        Args: { _payload: Json; _user_id: string }
        Returns: undefined
      }
      admin_desbloquear: { Args: { _id: string }; Returns: Json }
      admin_ebooks_resumo: {
        Args: never
        Returns: {
          aberturas: number
          ebook_id: string
          leitores: number
          ultima: string
        }[]
      }
      admin_excluir_conta: { Args: { _user_id: string }; Returns: Json }
      admin_exigir_2fa: { Args: { _ligar: boolean }; Returns: boolean }
      admin_manutencao_definir: {
        Args: {
          _dispositivo?: string
          _duracao_bloqueio_min: number
          _mensagem: string
          _modulos: string[]
          _status: string
          _termina_em?: string
          _titulo: string
        }
        Returns: Json
      }
      admin_metricas: { Args: never; Returns: Json }
      admin_pagamentos: {
        Args: { _limite?: number; _status?: string }
        Returns: {
          aprovado_em: string
          criado_em: string
          email: string
          id: string
          meses: number
          metodo: string
          mp_payment_id: string
          plano_nome: string
          propriedade: string
          status: string
          valor_centavos: number
        }[]
      }
      admin_responder_suporte: {
        Args: { _fechar?: boolean; _id: string; _resposta: string }
        Returns: boolean
      }
      admin_saude: { Args: never; Returns: Json }
      admin_seguranca_painel: {
        Args: {
          _ate?: string
          _desde?: string
          _dispositivo?: string
          _ip?: string
          _status?: string
          _tipo?: string
        }
        Returns: Json
      }
      admin_sistema: { Args: never; Returns: Json }
      admin_suporte: {
        Args: { _limite?: number; _status?: string }
        Returns: {
          assunto: string
          criado_em: string
          email: string
          id: string
          mensagem: string
          propriedade: string
          respondido_em: string
          resposta: string
          status: string
        }[]
      }
      admin_tempo_real: { Args: never; Returns: Json }
      agenda_periodo: {
        Args: { _ate: string; _de: string; _propriedade_id: string }
        Returns: Json
      }
      app_diagnostico: { Args: { p_propriedade_id: string }; Returns: Json }
      app_sincronizar: {
        Args: {
          p_apos_id?: string
          p_apos_updated_at?: string
          p_limite?: number
          p_propriedade_id: string
          p_tabela: string
        }
        Returns: Json[]
      }
      cancelar_plano_demonstracao: {
        Args: { _motivo?: string; _propriedade_id: string }
        Returns: Json
      }
      central_avisos: { Args: { _propriedade_id: string }; Returns: Json }
      checar_limite: {
        Args: { _chave: string; _max: number; _segundos: number }
        Returns: boolean
      }
      dashboard_resumo: { Args: { _propriedade_id: string }; Returns: Json }
      diagnostico_propriedade: {
        Args: { _propriedade_id: string }
        Returns: Json
      }
      ebook_registrar_acesso: {
        Args: { _ebook: string; _ip: string; _user: string }
        Returns: Json
      }
      encerrar_sessao: { Args: { _id: string }; Returns: boolean }
      estado_manutencao: { Args: never; Returns: Json }
      indicadores_propriedade: {
        Args: { _propriedade_id: string }
        Returns: Json
      }
      minha_area_assinante: { Args: never; Returns: Json }
      minha_assinatura: { Args: { _propriedade_id: string }; Returns: Json }
      minhas_sessoes: {
        Args: never
        Returns: {
          aal: string
          atual: boolean
          criada_em: string
          id: string
          ip: string
          navegador: string
          ultimo_uso: string
        }[]
      }
      mp_ativar_assinatura: {
        Args: {
          _detalhes: Json
          _metodo: string
          _mp_payment_id: string
          _pagamento: string
        }
        Returns: Json
      }
      mp_estornar: {
        Args: { _motivo: string; _mp_payment_id: string }
        Returns: Json
      }
      mp_registrar_status: {
        Args: {
          _detalhes: Json
          _metodo: string
          _mp_payment_id: string
          _pagamento: string
          _status: string
        }
        Returns: undefined
      }
      pode_gerenciar_planos: { Args: never; Returns: boolean }
      registros_inconsistentes: {
        Args: { _propriedade_id: string }
        Returns: Json
      }
      relatorio_indicadores: {
        Args: { _ate?: string; _de?: string; _propriedade_id: string }
        Returns: Json
      }
      seg_registrar_incidente: {
        Args: {
          _agente: string
          _bloquear: boolean
          _caminho: string
          _detalhes: Json
          _disp: string
          _ip: string
          _metodo: string
          _motivo: string
          _severidade: string
          _tipo: string
          _user: string
        }
        Returns: string
      }
      seg_tentativa_bloqueado: {
        Args: { _tipo: string; _valor: string }
        Returns: undefined
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
      sou_assinante: { Args: never; Returns: boolean }
      yui_consumir: {
        Args: { _limite: number; _tipo: string; _user: string }
        Returns: boolean
      }
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
