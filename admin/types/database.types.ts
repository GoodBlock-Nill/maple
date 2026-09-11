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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      admin_invites: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string | null
          id: string
          invited_by: string | null
          role_id: string | null
          status: string
          token_hash: string | null
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at?: string | null
          id?: string
          invited_by?: string | null
          role_id?: string | null
          status?: string
          token_hash?: string | null
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string | null
          id?: string
          invited_by?: string | null
          role_id?: string | null
          status?: string
          token_hash?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_invites_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_invites_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "admin_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_roles: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_system: boolean
          key: string
          name: string
          permissions: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_system?: boolean
          key: string
          name: string
          permissions?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_system?: boolean
          key?: string
          name?: string
          permissions?: Json
          updated_at?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          after: Json | null
          before: Json | null
          created_at: string
          id: string
          target_id: string | null
          target_table: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          id?: string
          target_id?: string | null
          target_table?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          id?: string
          target_id?: string | null
          target_table?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      board_categories: {
        Row: {
          board: Database["public"]["Enums"]["board_type"]
          color: string
          created_at: string
          id: string
          is_active: boolean
          key: string
          label: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          board: Database["public"]["Enums"]["board_type"]
          color: string
          created_at?: string
          id?: string
          is_active?: boolean
          key: string
          label: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          board?: Database["public"]["Enums"]["board_type"]
          color?: string
          created_at?: string
          id?: string
          is_active?: boolean
          key?: string
          label?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      comments: {
        Row: {
          author_id: string | null
          author_name: string
          content: string
          created_at: string
          deleted_at: string | null
          id: string
          is_hidden: boolean
          post_id: string
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          author_name: string
          content: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_hidden?: boolean
          post_id: string
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          author_name?: string
          content?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_hidden?: boolean
          post_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      coupon_redemptions: {
        Row: {
          admin_note: string | null
          coupon_id: string
          created_at: string
          id: string
          msw_profile_code: string
          msw_uid: string
          nickname_snapshot: string | null
          processed_at: string | null
          processed_by: string | null
          status: string
          user_id: string | null
        }
        Insert: {
          admin_note?: string | null
          coupon_id: string
          created_at?: string
          id?: string
          msw_profile_code: string
          msw_uid: string
          nickname_snapshot?: string | null
          processed_at?: string | null
          processed_by?: string | null
          status?: string
          user_id?: string | null
        }
        Update: {
          admin_note?: string | null
          coupon_id?: string
          created_at?: string
          id?: string
          msw_profile_code?: string
          msw_uid?: string
          nickname_snapshot?: string | null
          processed_at?: string | null
          processed_by?: string | null
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coupon_redemptions_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_redemptions_processed_by_fkey"
            columns: ["processed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_redemptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      coupons: {
        Row: {
          code: string
          code_normalized: string | null
          created_at: string
          created_by: string | null
          description: string | null
          ends_at: string | null
          id: string
          is_active: boolean
          max_redemptions: number | null
          name: string
          per_user_limit: number
          reward_note: string | null
          starts_at: string | null
          updated_at: string
        }
        Insert: {
          code: string
          code_normalized?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at?: string | null
          id?: string
          is_active?: boolean
          max_redemptions?: number | null
          name: string
          per_user_limit?: number
          reward_note?: string | null
          starts_at?: string | null
          updated_at?: string
        }
        Update: {
          code?: string
          code_normalized?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at?: string | null
          id?: string
          is_active?: boolean
          max_redemptions?: number | null
          name?: string
          per_user_limit?: number
          reward_note?: string | null
          starts_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "coupons_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      email_inbound_events: {
        Row: {
          id: string
          received_at: string
        }
        Insert: {
          id: string
          received_at?: string
        }
        Update: {
          id?: string
          received_at?: string
        }
        Relationships: []
      }
      faqs: {
        Row: {
          answer: string
          category: Database["public"]["Enums"]["faq_category"]
          created_at: string
          id: string
          is_published: boolean
          question: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          answer: string
          category: Database["public"]["Enums"]["faq_category"]
          created_at?: string
          id?: string
          is_published?: boolean
          question: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          answer?: string
          category?: Database["public"]["Enums"]["faq_category"]
          created_at?: string
          id?: string
          is_published?: boolean
          question?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      gacha_items: {
        Row: {
          created_at: string
          icon_url: string | null
          id: string
          is_published: boolean
          name: string
          probability: number
          published_at: string
          rows: Json
          tab: Database["public"]["Enums"]["gacha_tab"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          icon_url?: string | null
          id?: string
          is_published?: boolean
          name: string
          probability?: number
          published_at?: string
          rows?: Json
          tab: Database["public"]["Enums"]["gacha_tab"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          icon_url?: string | null
          id?: string
          is_published?: boolean
          name?: string
          probability?: number
          published_at?: string
          rows?: Json
          tab?: Database["public"]["Enums"]["gacha_tab"]
          updated_at?: string
        }
        Relationships: []
      }
      hero_banners: {
        Row: {
          created_at: string
          cta_label: string | null
          ends_at: string | null
          id: string
          image_url: string | null
          is_active: boolean
          link_url: string | null
          media_type: string
          sort_order: number
          starts_at: string | null
          subtitle: string | null
          title: string
          updated_at: string
          video_url: string | null
        }
        Insert: {
          created_at?: string
          cta_label?: string | null
          ends_at?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          link_url?: string | null
          media_type?: string
          sort_order?: number
          starts_at?: string | null
          subtitle?: string | null
          title: string
          updated_at?: string
          video_url?: string | null
        }
        Update: {
          created_at?: string
          cta_label?: string | null
          ends_at?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          link_url?: string | null
          media_type?: string
          sort_order?: number
          starts_at?: string | null
          subtitle?: string | null
          title?: string
          updated_at?: string
          video_url?: string | null
        }
        Relationships: []
      }
      inquiries: {
        Row: {
          account_id: string | null
          answered_at: string | null
          attachments: Json
          cancelled_at: string | null
          category: string
          contact_email: string | null
          content: string
          created_at: string
          email_auth: Json | null
          email_from: string | null
          email_from_name: string | null
          email_message_id: string | null
          email_thread_key: string | null
          id: string
          privacy_consent: boolean
          source: string
          status: Database["public"]["Enums"]["inquiry_status"]
          title: string
          type: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          account_id?: string | null
          answered_at?: string | null
          attachments?: Json
          cancelled_at?: string | null
          category: string
          contact_email?: string | null
          content: string
          created_at?: string
          email_auth?: Json | null
          email_from?: string | null
          email_from_name?: string | null
          email_message_id?: string | null
          email_thread_key?: string | null
          id?: string
          privacy_consent?: boolean
          source?: string
          status?: Database["public"]["Enums"]["inquiry_status"]
          title: string
          type: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          account_id?: string | null
          answered_at?: string | null
          attachments?: Json
          cancelled_at?: string | null
          category?: string
          contact_email?: string | null
          content?: string
          created_at?: string
          email_auth?: Json | null
          email_from?: string | null
          email_from_name?: string | null
          email_message_id?: string | null
          email_thread_key?: string | null
          id?: string
          privacy_consent?: boolean
          source?: string
          status?: Database["public"]["Enums"]["inquiry_status"]
          title?: string
          type?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inquiries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      inquiry_categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          key: string
          label: string
          prefill: string
          sort_order: number
          subtypes: string[]
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          key: string
          label: string
          prefill?: string
          sort_order?: number
          subtypes?: string[]
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          key?: string
          label?: string
          prefill?: string
          sort_order?: number
          subtypes?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      inquiry_replies: {
        Row: {
          author_id: string | null
          author_name: string
          content: string
          created_at: string
          delivery_status: string | null
          direction: string
          email_message_id: string | null
          id: string
          inquiry_id: string
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          author_name?: string
          content: string
          created_at?: string
          delivery_status?: string | null
          direction?: string
          email_message_id?: string | null
          id?: string
          inquiry_id: string
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          author_name?: string
          content?: string
          created_at?: string
          delivery_status?: string | null
          direction?: string
          email_message_id?: string | null
          id?: string
          inquiry_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inquiry_replies_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inquiry_replies_inquiry_id_fkey"
            columns: ["inquiry_id"]
            isOneToOne: false
            referencedRelation: "inquiries"
            referencedColumns: ["id"]
          },
        ]
      }
      inquiry_reply_templates: {
        Row: {
          body: string
          category_id: string | null
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          name: string
          sort_order: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          body: string
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          body?: string
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inquiry_reply_templates_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "inquiry_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inquiry_reply_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inquiry_reply_templates_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_document_versions: {
        Row: {
          content_html: string
          created_at: string
          created_by: string | null
          document_id: string
          effective_date: string
          id: string
          is_published: boolean
          published_at: string | null
          summary: string | null
          version: string
        }
        Insert: {
          content_html: string
          created_at?: string
          created_by?: string | null
          document_id: string
          effective_date: string
          id?: string
          is_published?: boolean
          published_at?: string | null
          summary?: string | null
          version: string
        }
        Update: {
          content_html?: string
          created_at?: string
          created_by?: string | null
          document_id?: string
          effective_date?: string
          id?: string
          is_published?: boolean
          published_at?: string | null
          summary?: string | null
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "legal_document_versions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "legal_document_versions_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "legal_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_documents: {
        Row: {
          created_at: string
          id: string
          slug: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          slug: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          slug?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      news_category_templates: {
        Row: {
          board: Database["public"]["Enums"]["board_type"]
          body_template: string
          category_key: string
          created_at: string
          id: string
          is_active: boolean
          summary_template: string
          title_template: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          board?: Database["public"]["Enums"]["board_type"]
          body_template?: string
          category_key: string
          created_at?: string
          id?: string
          is_active?: boolean
          summary_template?: string
          title_template?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          board?: Database["public"]["Enums"]["board_type"]
          body_template?: string
          category_key?: string
          created_at?: string
          id?: string
          is_active?: boolean
          summary_template?: string
          title_template?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "news_category_templates_category_fkey"
            columns: ["board", "category_key"]
            isOneToOne: false
            referencedRelation: "board_categories"
            referencedColumns: ["board", "key"]
          },
          {
            foreignKeyName: "news_category_templates_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      post_likes: {
        Row: {
          created_at: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          author_id: string | null
          author_name: string
          board: Database["public"]["Enums"]["board_type"]
          category_key: string
          comment_count: number
          content: string
          content_format: Database["public"]["Enums"]["content_format"]
          created_at: string
          deleted_at: string | null
          edited_at: string | null
          id: string
          is_hidden: boolean
          is_pinned: boolean
          is_published: boolean
          like_count: number
          published_at: string
          summary: string | null
          thumbnail_url: string | null
          title: string
          updated_at: string
          view_count: number
        }
        Insert: {
          author_id?: string | null
          author_name: string
          board: Database["public"]["Enums"]["board_type"]
          category_key: string
          comment_count?: number
          content: string
          content_format?: Database["public"]["Enums"]["content_format"]
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          is_hidden?: boolean
          is_pinned?: boolean
          is_published?: boolean
          like_count?: number
          published_at?: string
          summary?: string | null
          thumbnail_url?: string | null
          title: string
          updated_at?: string
          view_count?: number
        }
        Update: {
          author_id?: string | null
          author_name?: string
          board?: Database["public"]["Enums"]["board_type"]
          category_key?: string
          comment_count?: number
          content?: string
          content_format?: Database["public"]["Enums"]["content_format"]
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          is_hidden?: boolean
          is_pinned?: boolean
          is_published?: boolean
          like_count?: number
          published_at?: string
          summary?: string | null
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_category_fkey"
            columns: ["board", "category_key"]
            isOneToOne: false
            referencedRelation: "board_categories"
            referencedColumns: ["board", "key"]
          },
        ]
      }
      profiles: {
        Row: {
          admin_role_id: string | null
          age_confirmed_at: string | null
          avatar_url: string | null
          created_at: string
          deleted_at: string | null
          email: string | null
          id: string
          marketing_email_opt_out: boolean
          marketing_sms_opt_out: boolean
          msw_profile_code: string | null
          msw_uid: string | null
          name: string | null
          nickname: string
          privacy_agreed_at: string | null
          provider: string | null
          provider_id: string | null
          purged_at: string | null
          role: Database["public"]["Enums"]["user_role"]
          suspended_until: string | null
          suspension_reason: string | null
          terms_agreed_at: string | null
          updated_at: string
        }
        Insert: {
          admin_role_id?: string | null
          age_confirmed_at?: string | null
          avatar_url?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          id: string
          marketing_email_opt_out?: boolean
          marketing_sms_opt_out?: boolean
          msw_profile_code?: string | null
          msw_uid?: string | null
          name?: string | null
          nickname: string
          privacy_agreed_at?: string | null
          provider?: string | null
          provider_id?: string | null
          purged_at?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          suspended_until?: string | null
          suspension_reason?: string | null
          terms_agreed_at?: string | null
          updated_at?: string
        }
        Update: {
          admin_role_id?: string | null
          age_confirmed_at?: string | null
          avatar_url?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          id?: string
          marketing_email_opt_out?: boolean
          marketing_sms_opt_out?: boolean
          msw_profile_code?: string | null
          msw_uid?: string | null
          name?: string | null
          nickname?: string
          privacy_agreed_at?: string | null
          provider?: string | null
          provider_id?: string | null
          purged_at?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          suspended_until?: string | null
          suspension_reason?: string | null
          terms_agreed_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_admin_role_id_fkey"
            columns: ["admin_role_id"]
            isOneToOne: false
            referencedRelation: "admin_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      rankings: {
        Row: {
          avatar_url: string | null
          character_name: string
          created_at: string
          exp: string | null
          guild: string | null
          guild_icon_url: string | null
          id: string
          job: string
          job_group: Database["public"]["Enums"]["job_group"]
          level: number
          rank: number
          rank_type: Database["public"]["Enums"]["ranking_type"]
          snapshot_at: string
        }
        Insert: {
          avatar_url?: string | null
          character_name: string
          created_at?: string
          exp?: string | null
          guild?: string | null
          guild_icon_url?: string | null
          id?: string
          job: string
          job_group: Database["public"]["Enums"]["job_group"]
          level?: number
          rank: number
          rank_type?: Database["public"]["Enums"]["ranking_type"]
          snapshot_at?: string
        }
        Update: {
          avatar_url?: string | null
          character_name?: string
          created_at?: string
          exp?: string | null
          guild?: string | null
          guild_icon_url?: string | null
          id?: string
          job?: string
          job_group?: Database["public"]["Enums"]["job_group"]
          level?: number
          rank?: number
          rank_type?: Database["public"]["Enums"]["ranking_type"]
          snapshot_at?: string
        }
        Relationships: []
      }
      reports: {
        Row: {
          created_at: string
          detail: string | null
          id: string
          note: string | null
          reason: Database["public"]["Enums"]["report_reason"]
          reporter_id: string
          resolved_at: string | null
          resolved_by: string | null
          status: string
          target_id: string
          target_type: string
        }
        Insert: {
          created_at?: string
          detail?: string | null
          id?: string
          note?: string | null
          reason: Database["public"]["Enums"]["report_reason"]
          reporter_id: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          target_id: string
          target_type: string
        }
        Update: {
          created_at?: string
          detail?: string | null
          id?: string
          note?: string | null
          reason?: Database["public"]["Enums"]["report_reason"]
          reporter_id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          target_id?: string
          target_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      site_settings: {
        Row: {
          contact_email: string | null
          copyright: string | null
          creator_intro: string | null
          creator_name: string | null
          creator_photo_url: string | null
          creator_slogan: string | null
          discord_url: string | null
          game_name: string
          id: number
          ip_notice: string | null
          updated_at: string
          world_id: string | null
          youtube_url: string | null
        }
        Insert: {
          contact_email?: string | null
          copyright?: string | null
          creator_intro?: string | null
          creator_name?: string | null
          creator_photo_url?: string | null
          creator_slogan?: string | null
          discord_url?: string | null
          game_name?: string
          id?: number
          ip_notice?: string | null
          updated_at?: string
          world_id?: string | null
          youtube_url?: string | null
        }
        Update: {
          contact_email?: string | null
          copyright?: string | null
          creator_intro?: string | null
          creator_name?: string | null
          creator_photo_url?: string | null
          creator_slogan?: string | null
          discord_url?: string | null
          game_name?: string
          id?: number
          ip_notice?: string | null
          updated_at?: string
          world_id?: string | null
          youtube_url?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_report_target: {
        Args: { p_target_id: string; p_target_type: string }
        Returns: boolean
      }
      current_legal_version: {
        Args: { p_slug: string }
        Returns: {
          content_html: string
          effective_date: string
          published_at: string
          slug: string
          summary: string
          title: string
          version: string
        }[]
      }
      increment_post_view: { Args: { p_id: string }; Returns: number }
      inquiry_category_usage: {
        Args: never
        Returns: {
          category: string
          total: number
        }[]
      }
      inquiry_subtypes_valid: {
        Args: { p_subtypes: string[] }
        Returns: boolean
      }
      inquiry_type_usage: {
        Args: never
        Returns: {
          total: number
          type: string
        }[]
      }
      is_admin: { Args: never; Returns: boolean }
      is_super_admin: { Args: never; Returns: boolean }
      is_suspended: { Args: never; Returns: boolean }
      is_withdrawn: { Args: never; Returns: boolean }
      mask_coupon_code: { Args: { p_code: string }; Returns: string }
      my_coupon_redemptions: {
        Args: never
        Returns: {
          admin_note: string
          code_masked: string
          coupon_name: string
          created_at: string
          id: string
          msw_profile_code: string
          msw_uid: string
          processed_at: string
          reward_note: string
          status: string
        }[]
      }
      purge_withdrawn_profiles: {
        Args: { p_cutoff?: string }
        Returns: string[]
      }
      redeem_coupon: {
        Args: { p_code: string; p_msw_profile_code: string; p_msw_uid: string }
        Returns: Json
      }
      replace_ranking_snapshot: {
        Args: {
          p_rank_type: Database["public"]["Enums"]["ranking_type"]
          p_rows: Json
        }
        Returns: string
      }
      stale_inquiry_pending_attachments: {
        Args: { p_cutoff_hours?: number; p_limit?: number }
        Returns: {
          path: string
        }[]
      }
      update_inquiry_category: {
        Args: {
          p_description: string
          p_id: string
          p_is_active: boolean
          p_key: string
          p_label: string
          p_prefill: string
          p_sort_order: number
          p_subtypes: string[]
        }
        Returns: number
      }
    }
    Enums: {
      board_type: "news" | "community"
      content_format: "markdown" | "html"
      faq_category: "notice" | "account" | "payment" | "bug" | "etc"
      gacha_tab: "premium" | "cube" | "scroll"
      inquiry_status: "pending" | "in_progress" | "answered" | "closed"
      job_group: "adventurer" | "cygnus" | "resistance" | "hero" | "demon"
      ranking_type: "total" | "job" | "guild"
      report_reason: "spam" | "abuse" | "obscene" | "privacy" | "other"
      user_role: "user" | "admin"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      board_type: ["news", "community"],
      content_format: ["markdown", "html"],
      faq_category: ["notice", "account", "payment", "bug", "etc"],
      gacha_tab: ["premium", "cube", "scroll"],
      inquiry_status: ["pending", "in_progress", "answered", "closed"],
      job_group: ["adventurer", "cygnus", "resistance", "hero", "demon"],
      ranking_type: ["total", "job", "guild"],
      report_reason: ["spam", "abuse", "obscene", "privacy", "other"],
      user_role: ["user", "admin"],
    },
  },
} as const
